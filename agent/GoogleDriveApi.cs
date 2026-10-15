using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;

namespace HomeSecurity.Agent;

public sealed class DriveFailure(string code, bool blocked = false, bool retry = false) : Exception(code)
{
    public string Code { get; } = code;
    public bool Blocked { get; } = blocked;
    public bool Retry { get; } = retry;
}

public sealed record DriveCredential(string ClientId, string ClientSecret, string RefreshToken);

// Real Google endpoints, no frontend dependency, no default Authorization headers or redirect following.
public sealed class GoogleDriveApi : IDisposable
{
    private readonly HttpClient http;
    private readonly IntegrationCredentials credentials;
    private readonly SecretStore? sessions;
    private readonly Dictionary<Guid,(string Revision,string Token,DateTimeOffset Until)> tokens=new();
    public GoogleDriveApi(IntegrationCredentials credentials, HttpMessageHandler? handler = null, string? sessionDirectory = null)
    {
        this.credentials = credentials;
        sessions=sessionDirectory is null?null:new SecretStore(sessionDirectory);
        http = new HttpClient(handler ?? new HttpClientHandler { AllowAutoRedirect = false }) { Timeout = TimeSpan.FromSeconds(60), MaxResponseContentBufferSize=65536 };
    }
    public void Dispose() { tokens.Clear(); http.Dispose(); }
    private async Task<string> AccessToken(Guid integration, CancellationToken ct)
    {
        var revision=credentials.DriveRevision(integration);
        if(tokens.TryGetValue(integration,out var cached) && cached.Revision==revision && cached.Until>DateTimeOffset.UtcNow) return cached.Token;
        var bytes = credentials.ResolveDrive(integration);
        try {
            var value = JsonSerializer.Deserialize<DriveCredential>(bytes) ?? throw new DriveFailure("SECRET_FORMAT", true);
            using var response = await http.PostAsync("https://oauth2.googleapis.com/token", new FormUrlEncodedContent(new Dictionary<string,string> {
                ["client_id"] = value.ClientId, ["client_secret"] = value.ClientSecret,
                ["refresh_token"] = value.RefreshToken, ["grant_type"] = "refresh_token" }), ct);
            if (response.StatusCode == HttpStatusCode.BadRequest || response.StatusCode == HttpStatusCode.Unauthorized)
                throw new DriveFailure("GOOGLE_REAUTH_REQUIRED", true);
            await Ensure(response,ct);
            using var json = await ReadJson(response,ct);
            var token=json.RootElement.GetProperty("access_token").GetString() ?? throw new DriveFailure("TOKEN_RESPONSE_INVALID",true);
            var seconds=json.RootElement.GetProperty("expires_in").GetInt32();
            if(seconds<=0 || seconds>86400) throw new DriveFailure("TOKEN_RESPONSE_INVALID",true);
            tokens[integration]=(revision,token,DateTimeOffset.UtcNow.AddSeconds(Math.Max(0,seconds-60)));
            return token;
        } catch (JsonException) { throw new DriveFailure("SECRET_FORMAT",true); }
        finally { CryptographicOperations.ZeroMemory(bytes); }
    }
    private async Task<HttpResponseMessage> Send(Guid integration, Func<HttpRequestMessage> factory, CancellationToken ct)
    {
        for (var attempt=0; attempt<2; attempt++) {
            var token = await AccessToken(integration,ct);
            using var request = factory(); request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            var response = await http.SendAsync(request,HttpCompletionOption.ResponseContentRead,ct);
            if (response.StatusCode != HttpStatusCode.Unauthorized) return response;
            tokens.Remove(integration);
            response.Dispose();
        }
        throw new DriveFailure("GOOGLE_REAUTH_REQUIRED",true);
    }
    internal static async Task Ensure(HttpResponseMessage response,CancellationToken ct)
    {
        if (response.IsSuccessStatusCode) return;
        if (response.StatusCode == HttpStatusCode.Unauthorized) throw new DriveFailure("GOOGLE_REAUTH_REQUIRED",true);
        if (response.StatusCode == HttpStatusCode.Forbidden) {
            var retry = false;
            try { using var json = await ReadJson(response,ct);
                retry = json.RootElement.GetProperty("error").GetProperty("errors").EnumerateArray().Any(e =>
                    e.GetProperty("reason").GetString() is "rateLimitExceeded" or "userRateLimitExceeded");
            } catch (Exception e) when (e is JsonException or KeyNotFoundException or InvalidOperationException) { }
            throw new DriveFailure(retry ? "GOOGLE_RATE_LIMIT" : "GOOGLE_PERMISSION_OR_QUOTA",!retry,retry);
        }
        throw new DriveFailure("GOOGLE_HTTP_"+(int)response.StatusCode,
            blocked: response.StatusCode is HttpStatusCode.NotFound,
            retry: (int)response.StatusCode >= 500 || (int)response.StatusCode is 429 or 408 or 409);
    }
    internal static async Task<JsonDocument> ReadJson(HttpResponseMessage response,CancellationToken ct)
    {
        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var buffer = new MemoryStream(); var chunk = new byte[4096]; int n;
        while ((n=await stream.ReadAsync(chunk,ct))>0) {
            if (buffer.Length+n>65536) throw new DriveFailure("RESPONSE_TOO_LARGE");
            buffer.Write(chunk,0,n);
        }
        return JsonDocument.Parse(buffer.ToArray());
    }
    public static string ValidateId(string id)
    {
        if (id.Length is < 1 or > 200 || id.Any(c=>!char.IsAsciiLetterOrDigit(c) && c is not '-' and not '_'))
            throw new ArgumentException("Invalid Google resource ID.");
        return id;
    }
    public async Task ValidateFolder(Guid integration,string folder,CancellationToken ct)
    {
        ValidateId(folder);
        using var response = await Send(integration,()=>new(HttpMethod.Get,
            "https://www.googleapis.com/drive/v3/files/"+folder+"?fields=id,mimeType,trashed,capabilities(canAddChildren)&supportsAllDrives=true"),ct);
        await Ensure(response,ct); using var json=await ReadJson(response,ct); var item=json.RootElement;
        if (item.GetProperty("mimeType").GetString()!="application/vnd.google-apps.folder" ||
            item.GetProperty("trashed").GetBoolean() || !item.GetProperty("capabilities").GetProperty("canAddChildren").GetBoolean())
            throw new DriveFailure("FOLDER_NOT_WRITABLE",true);
    }
    public async Task<string> GenerateId(Guid integration,CancellationToken ct)
    {
        using var response=await Send(integration,()=>new(HttpMethod.Get,"https://www.googleapis.com/drive/v3/files/generateIds?count=1&space=drive&type=files"),ct);
        await Ensure(response,ct); using var json=await ReadJson(response,ct);
        return ValidateId(json.RootElement.GetProperty("ids")[0].GetString()!);
    }
    public async Task<bool> Confirm(DriveUpload job,CancellationToken ct)
    {
        using var response=await Send(job.IntegrationId,()=>new(HttpMethod.Get,
            "https://www.googleapis.com/drive/v3/files/"+ValidateId(job.RemoteId!)+"?fields=id,size,md5Checksum,parents,trashed,appProperties&supportsAllDrives=true"),ct);
        if(response.StatusCode==HttpStatusCode.NotFound) return false;
        await Ensure(response,ct); using var json=await ReadJson(response,ct); var item=json.RootElement;
        var match=item.GetProperty("id").GetString()==job.RemoteId && !item.GetProperty("trashed").GetBoolean() &&
            item.GetProperty("size").GetString()==job.Size.ToString(System.Globalization.CultureInfo.InvariantCulture) &&
            string.Equals(item.GetProperty("md5Checksum").GetString(),job.Md5,StringComparison.OrdinalIgnoreCase) &&
            item.GetProperty("parents").EnumerateArray().Any(p=>p.GetString()==job.FolderId) &&
            item.GetProperty("appProperties").GetProperty("homeSecurityJob").GetString()==job.Id.ToString("N");
        if(!match) throw new DriveFailure("REMOTE_CONTENT_CONFLICT",true);
        return true;
    }
    private sealed record SavedSession(Guid IntegrationId,string RemoteId,string Uri);
    private static Uri ValidateSession(string value) {
        if(!Uri.TryCreate(value,UriKind.Absolute,out var uri) || uri.Scheme!="https" || uri.Host!="www.googleapis.com" || uri.Port!=443 ||
            !uri.AbsolutePath.StartsWith("/upload/drive/",StringComparison.Ordinal) || uri.UserInfo.Length!=0 || uri.Fragment.Length!=0)
            throw new DriveFailure("UPLOAD_LOCATION_REJECTED");
        return uri;
    }
    private Uri? LoadSession(DriveUpload job) {
        byte[]? bytes=null;
        try {
            bytes=sessions?.Read(job.Id.ToString("N")); if(bytes is null)return null;
            var saved=JsonSerializer.Deserialize<SavedSession>(bytes)!;
            if(saved.IntegrationId!=job.IntegrationId || saved.RemoteId!=job.RemoteId) throw new DriveFailure("SESSION_BINDING_INVALID",true);
            return ValidateSession(saved.Uri);
        } catch(Exception e) when(e is CryptographicException or JsonException or IOException) { throw new DriveFailure("SESSION_UNREADABLE",true); }
        finally { if(bytes is not null) CryptographicOperations.ZeroMemory(bytes); }
    }
    private void SaveSession(DriveUpload job,Uri session) {
        var bytes=JsonSerializer.SerializeToUtf8Bytes(new SavedSession(job.IntegrationId,job.RemoteId!,session.AbsoluteUri));
        try { sessions?.Save(job.Id.ToString("N"),bytes); } finally { CryptographicOperations.ZeroMemory(bytes); }
    }
    private static long Offset(HttpResponseMessage response,long total) {
        var range=response.Headers.TryGetValues("Range",out var values)?values.SingleOrDefault():null;
        if(range is null)return 0;
        if(!range.StartsWith("bytes=0-",StringComparison.Ordinal) || !long.TryParse(range[8..],out var last) || last<0 || last>=total)
            throw new DriveFailure("UPLOAD_PROGRESS_INVALID",retry:true);
        return last+1;
    }
    // Session URI is a bearer-like capability: DPAPI only, never SQLite or logs.
    // Lost responses query the existing session; an expired session restarts with the SAME reserved ID.
    public async Task Upload(DriveUpload job,FileStream file,Action renew,CancellationToken ct)
    {
        await ValidateFolder(job.IntegrationId,job.FolderId,ct); renew();
        if(await Confirm(job,ct)) return;
        var session=LoadSession(job); long offset=0;
        if(session is not null) {
            using var status=await Send(job.IntegrationId,()=> {
                var request=new HttpRequestMessage(HttpMethod.Put,session); request.Content=new ByteArrayContent([]);
                request.Content.Headers.TryAddWithoutValidation("Content-Range","bytes */"+job.Size); return request;
            },ct);
            if(status.IsSuccessStatusCode) {
                if(await Confirm(job,ct))return;
                throw new DriveFailure("UPLOAD_CONFIRMATION_PENDING",retry:true);
            }
            if((int)status.StatusCode==308) offset=Offset(status,job.Size);
            else if(status.StatusCode==HttpStatusCode.NotFound)session=null;
            else await Ensure(status,ct);
        }
        if(session is null) {
        using var start=await Send(job.IntegrationId,()=> {
            var r=new HttpRequestMessage(HttpMethod.Post,"https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true");
            r.Content=JsonContent.Create(new { id=job.RemoteId, name=job.Name, parents=new[]{job.FolderId},
                appProperties=new { homeSecurityJob=job.Id.ToString("N") } });
            r.Headers.TryAddWithoutValidation("X-Upload-Content-Type","application/octet-stream");
            r.Headers.TryAddWithoutValidation("X-Upload-Content-Length",job.Size.ToString(System.Globalization.CultureInfo.InvariantCulture)); return r;
        },ct);
        await Ensure(start,ct);
        session=ValidateSession(start.Headers.Location?.ToString()??"");
        SaveSession(job,session);
        }
        var buffer=new byte[1024*1024];
        while(offset<job.Size) {
            renew(); file.Position=offset; var count=(int)Math.Min(buffer.Length,job.Size-offset);
            await file.ReadExactlyAsync(buffer.AsMemory(0,count),ct);
            using var response=await Send(job.IntegrationId,()=> {
                var r=new HttpRequestMessage(HttpMethod.Put,session); r.Content=new ByteArrayContent(buffer,0,count);
                r.Content.Headers.ContentType=new MediaTypeHeaderValue("application/octet-stream");
                r.Content.Headers.ContentRange=new ContentRangeHeaderValue(offset,offset+count-1,job.Size); return r;
            },ct);
            if ((int)response.StatusCode==308) {
                var next=Offset(response,job.Size);
                if(next<=offset || next>offset+count)
                    throw new DriveFailure("UPLOAD_PROGRESS_INVALID",retry:true);
                offset=next;
            } else { await Ensure(response,ct); break; }
        }
        renew(); if(!await Confirm(job,ct)) throw new DriveFailure("UPLOAD_CONFIRMATION_PENDING",retry:true);
    }
}
