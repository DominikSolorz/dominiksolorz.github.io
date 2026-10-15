using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace HomeSecurity.Agent;

public static class GoogleDriveAuthorization
{
    public const string Scope="https://www.googleapis.com/auth/drive.file";
    private static string Base64Url(byte[] bytes)=>Convert.ToBase64String(bytes).TrimEnd('=').Replace('+','-').Replace('/','_');
    // User consent occurs in the system browser, never in WebView2. No tokens in command arguments.
    public static async Task Authorize(string clientJson,Guid integration,IntegrationCredentials store,CancellationToken cancellation,bool fullDrive=false)
    {
        if(new FileInfo(clientJson).Length>16384) throw new DriveFailure("OAUTH_CLIENT_FILE_INVALID",true);
        using var config=JsonDocument.Parse(await File.ReadAllBytesAsync(clientJson,cancellation));
        var installed=config.RootElement.GetProperty("installed");
        var clientId=installed.GetProperty("client_id").GetString()!;
        var clientSecret=installed.GetProperty("client_secret").GetString()!;
        if(!clientId.EndsWith(".apps.googleusercontent.com",StringComparison.Ordinal)) throw new DriveFailure("OAUTH_CLIENT_INVALID",true);
        var verifier=Base64Url(RandomNumberGenerator.GetBytes(32)); var state=Base64Url(RandomNumberGenerator.GetBytes(32));
        var challenge=Base64Url(SHA256.HashData(Encoding.ASCII.GetBytes(verifier)));
        using var timeout=CancellationTokenSource.CreateLinkedTokenSource(cancellation); timeout.CancelAfter(TimeSpan.FromMinutes(5)); var ct=timeout.Token;
        var listener=new TcpListener(IPAddress.Loopback,0); listener.Start();
        try {
            var port=((IPEndPoint)listener.LocalEndpoint).Port; var redirect="http://127.0.0.1:"+port+"/";
            var requestedScope=fullDrive?"https://www.googleapis.com/auth/drive":Scope;
            var query=new Dictionary<string,string> { ["client_id"]=clientId,["redirect_uri"]=redirect,["response_type"]="code",
                ["scope"]=requestedScope,["code_challenge"]=challenge,["code_challenge_method"]="S256",["state"]=state,["access_type"]="offline",["prompt"]="consent" };
            var url="https://accounts.google.com/o/oauth2/v2/auth?"+string.Join("&",query.Select(p=>Uri.EscapeDataString(p.Key)+"="+Uri.EscapeDataString(p.Value)));
            Process.Start(new ProcessStartInfo(url) { UseShellExecute=true });
            string? code=null;
            while(code is null) {
                using var connection=await listener.AcceptTcpClientAsync(ct); using var stream=connection.GetStream();
                using var connectionLimit=CancellationTokenSource.CreateLinkedTokenSource(ct); connectionLimit.CancelAfter(TimeSpan.FromSeconds(5));
                var bytes=new byte[8192]; var used=0;
                try {
                    while(used<bytes.Length) {
                        var n=await stream.ReadAsync(bytes.AsMemory(used),connectionLimit.Token); if(n==0) break; used+=n;
                        if(Encoding.ASCII.GetString(bytes,0,used).Contains("\r\n\r\n")) break;
                    }
                    var line=Encoding.ASCII.GetString(bytes,0,used).Split("\r\n")[0].Split(' ');
                    if(line.Length!=3 || line[0]!="GET" || !line[1].StartsWith("/?",StringComparison.Ordinal)) continue;
                    var values=new Dictionary<string,string>();
                    foreach(var part in line[1][2..].Split('&')) { var pair=part.Split('=',2); if(pair.Length!=2 || !values.TryAdd(Uri.UnescapeDataString(pair[0]),Uri.UnescapeDataString(pair[1].Replace('+',' ')))) throw new DriveFailure("OAUTH_CALLBACK_INVALID",true); }
                    if(!values.TryGetValue("state",out var received) || received!=state) continue;
                    var reply=Encoding.UTF8.GetBytes("HTTP/1.1 200 OK\r\nContent-Type: text/plain; charset=utf-8\r\nCache-Control: no-store\r\nConnection: close\r\n\r\nHOME SECURITY: mozna zamknac te karte. Wynik autoryzacji pojawi sie w programie.");
                    await stream.WriteAsync(reply,ct);
                    if(values.ContainsKey("error")) throw new DriveFailure("OAUTH_CONSENT_DENIED",true);
                    if(!values.TryGetValue("code",out code) || string.IsNullOrWhiteSpace(code)) throw new DriveFailure("OAUTH_CALLBACK_INVALID",true);
                } catch(OperationCanceledException) when(!ct.IsCancellationRequested) { }
            }
            using var http=new HttpClient(new HttpClientHandler { AllowAutoRedirect=false }) { Timeout=TimeSpan.FromSeconds(60) };
            using var response=await http.PostAsync("https://oauth2.googleapis.com/token",new FormUrlEncodedContent(new Dictionary<string,string> {
                ["client_id"]=clientId,["client_secret"]=clientSecret,["code"]=code,["code_verifier"]=verifier,["redirect_uri"]=redirect,["grant_type"]="authorization_code" }),ct);
            if(!response.IsSuccessStatusCode) throw new DriveFailure("OAUTH_EXCHANGE_FAILED",true);
            using var json=await GoogleDriveApi.ReadJson(response,ct);
            var granted=json.RootElement.GetProperty("scope").GetString() ?? "";
            if(!granted.Split(' ').Contains(requestedScope)) throw new DriveFailure("OAUTH_SCOPE_NOT_GRANTED",true);
            var token=json.RootElement.GetProperty("refresh_token").GetString();
            if(string.IsNullOrWhiteSpace(token)) throw new DriveFailure("OAUTH_REFRESH_TOKEN_MISSING",true);
            var secret=JsonSerializer.SerializeToUtf8Bytes(new DriveCredential(clientId,clientSecret,token));
            try { store.ConfigureDrive(integration,secret); } finally { CryptographicOperations.ZeroMemory(secret); }
        } finally { listener.Stop(); }
    }
}
