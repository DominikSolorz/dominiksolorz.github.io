using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using HomeSecurity.Agent;
using Microsoft.Data.Sqlite;

static class DriveTests
{
    public static async Task Run(Action<bool,string> check,string root)
    {
        var picker=new Dictionary<string,string>();GoogleDriveAuthorization.AddPickerParameters(picker,"folder1");
        check(picker["scope"]==GoogleDriveAuthorization.Scope && picker["include_granted_scopes"]=="false","desktop picker requests only drive.file");
        check(picker["trigger_onepick"]=="true" && picker["allow_folder_selection"]=="true" && picker["file_ids"]=="folder1" && picker["allow_multiple"]=="false","desktop picker filters one expected folder");
        GoogleDriveAuthorization.ValidatePickedFolder("folder1","folder1");
        check(true,"matching picked folder accepted");
        var wrongPick=false;try{GoogleDriveAuthorization.ValidatePickedFolder("folder2","folder1");}catch(DriveFailure){wrongPick=true;}
        check(wrongPick,"different picked folder rejected before credential rotation");
        var missingPick=false;try{GoogleDriveAuthorization.ValidatePickedFolder(null,"folder1");}catch(DriveFailure){missingPick=true;}
        check(missingPick,"missing picker callback rejected");
        var db=new AgentDatabase(root); var creds=new IntegrationCredentials(db,Path.Combine(root,"secrets")); var integration=Guid.NewGuid();
        var secret=JsonSerializer.SerializeToUtf8Bytes(new DriveCredential("local-fixture.apps.googleusercontent.com","fake-client","fake-refresh"));
        try { creds.ConfigureDrive(integration,secret); } finally { CryptographicOperations.ZeroMemory(secret); }
        var path=Path.Combine(root,"payload.bin"); await File.WriteAllBytesAsync(path,RandomNumberGenerator.GetBytes(1024*1024+123));
        var queue=new DriveUploadQueue(db); var job=queue.Enqueue(integration,path,"folder1");
        var handler=new Server(); using var api=new GoogleDriveApi(creds,handler); var worker=new DriveUploadWorker(queue,api);
        await worker.RunOne();
        check(queue.Status(job)=="retry_wait","ambiguous upload schedules reconciliation");
        check(handler.Creates==1 && handler.Completed,"server accepted upload before lost response");
        using var sql=new SqliteConnection("Data Source="+Path.Combine(root,"agent.db")); sql.Open(); using var c=sql.CreateCommand();
        c.CommandText="UPDATE drive_uploads SET next_ms=0 WHERE id=$id"; c.Parameters.AddWithValue("$id",job.ToString()); c.ExecuteNonQuery();
        await worker.RunOne();
        check(queue.Status(job)=="succeeded" && handler.Creates==1 && handler.Generated==1,"retry confirms same remote ID without duplicate create");
        check(handler.TokenCalls==1,"access token cached in memory");
        check(creds.ProbeFake(integration).Status=="not_applicable","real provider never reports fake success");
        check(!Directory.GetFiles(root,"agent.db*").Any(p=> {
            using var f=new FileStream(p,FileMode.Open,FileAccess.Read,FileShare.ReadWrite|FileShare.Delete);
            using var bytes=new MemoryStream();f.CopyTo(bytes);return System.Text.Encoding.UTF8.GetString(bytes.ToArray()).Contains("fake-refresh");
        }),"Drive queue contains no refresh token");
        var changed=queue.Enqueue(integration,path,"folder1"); await File.WriteAllTextAsync(path,"changed"); await worker.RunOne();
        check(queue.Status(changed)=="blocked","changed input blocked before network upload");
        var blocked=queue.Enqueue(integration,path,"folder1"); creds.Disable(integration); await worker.RunOne();
        check(queue.Status(blocked)=="blocked","disabled Drive integration blocked");
        queue.ResumeBlocked(blocked); check(queue.Status(blocked)=="queued","explicit resume preserves job identity");
        var fresh=new IntegrationCredentials(db,Path.Combine(root,"secrets"));
        var s=JsonSerializer.SerializeToUtf8Bytes(new DriveCredential("x.apps.googleusercontent.com","fake-client","fake-refresh"));
        try{fresh.ConfigureDrive(integration,s);}finally{CryptographicOperations.ZeroMemory(s);}
        using var revokedApi=new GoogleDriveApi(fresh,new Server { Revoked=true });
        await new DriveUploadWorker(queue,revokedApi).RunOne(); check(queue.Status(blocked)=="blocked","revoked refresh grant requires reauthorization");
        var invalid=false; try{GoogleDriveApi.ValidateId("../escape");}catch(ArgumentException){invalid=true;}
        check(invalid,"Google resource ID validation");
        using var forbidden=new HttpResponseMessage(HttpStatusCode.Forbidden) { Content=JsonContent.Create(new{error=new{errors=new[]{new{reason="userRateLimitExceeded"}}}}) };
        var transient=false;try{await GoogleDriveApi.Ensure(forbidden,CancellationToken.None);}catch(DriveFailure e){transient=e.Retry&&!e.Blocked;}
        check(transient,"Google rate limit is retryable not auth failure");
        using var http401=new Server { UnauthorizedOnce=true }; using var retryApi=new GoogleDriveApi(fresh,http401);
        await retryApi.GenerateId(integration,CancellationToken.None);
        check(http401.TokenCalls==2,"401 refreshes access token once");
        var largeInput=Path.Combine(root,"large-input.bin");
        using(var sparse=new FileStream(largeInput,FileMode.Create,FileAccess.Write,FileShare.None))sparse.SetLength(2L*1024*1024*1024+17);
        using(var readable=DriveUploadQueue.OpenInput(largeInput))check(readable.Length>int.MaxValue,"multi-GiB recording opens without loading it into memory");
        var invalidName=false;try{queue.Enqueue(integration,path,"folder1","../escape.mp4");}catch(ArgumentException){invalidName=true;}
        check(invalidName,"recovered recording display name cannot contain a path");
        var resumePath=Path.Combine(root,"resume.bin");await File.WriteAllBytesAsync(resumePath,RandomNumberGenerator.GetBytes(8*1024*1024+99));
        var resumeJob=queue.Enqueue(integration,resumePath,"folder1");var interrupted=new Server{LoseFirstChunk=true};
        using var beforeRestart=new GoogleDriveApi(fresh,interrupted,Path.Combine(root,"sessions"));
        await new DriveUploadWorker(queue,beforeRestart).RunOne();
        check(queue.Status(resumeJob)=="retry_wait","partial chunk response loss retains retryable job");
        var progressDetails=JsonSerializer.SerializeToElement(queue.Details(resumeJob));
        var progressJob=new DriveUpload(resumeJob,integration,resumePath,"folder1","resume.bin",new FileInfo(resumePath).Length,"",progressDetails.GetProperty("remoteId").GetString(),"",1);
        check(await beforeRestart.AcknowledgedBytes(progressJob,CancellationToken.None)==8L*1024*1024,"operator progress comes from Google acknowledged byte range");
        c.CommandText="UPDATE drive_uploads SET next_ms=0 WHERE id=$id";c.Parameters["$id"].Value=resumeJob.ToString();c.ExecuteNonQuery();
        using var afterRestart=new GoogleDriveApi(fresh,interrupted,Path.Combine(root,"sessions"));
        await new DriveUploadWorker(queue,afterRestart).RunOne();
        // The final response is deliberately lost too; reconcile it on the next attempt.
        c.ExecuteNonQuery();await new DriveUploadWorker(queue,afterRestart).RunOne();
        check(queue.Status(resumeJob)=="succeeded"&&interrupted.Creates==1&&interrupted.StatusQueries==2,"DPAPI session resumes at server offset after adapter restart");
    }
    private sealed class Server : HttpMessageHandler
    {
        public int Creates,Generated,TokenCalls,StatusQueries; public bool Completed,Revoked,UnauthorizedOnce,LoseFirstChunk;
        string? id,md5,jobId;long size,received;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage r,CancellationToken ct)
        {
            HttpResponseMessage Json(object value)=>new(HttpStatusCode.OK){Content=JsonContent.Create(value)};
            var url=r.RequestUri!;
            if(url.Host=="oauth2.googleapis.com") { TokenCalls++; return Revoked?new(HttpStatusCode.BadRequest):Json(new{access_token="fake-access",expires_in=3600}); }
            if(r.Headers.Authorization?.Parameter!="fake-access") throw new Exception("Authorization missing");
            if(UnauthorizedOnce){UnauthorizedOnce=false;return new(HttpStatusCode.Unauthorized);}
            if(url.AbsolutePath.EndsWith("generateIds")){Generated++;return Json(new{ids=new[]{"reserved"+Generated}});}
            if(url.AbsolutePath.EndsWith("folder1"))return Json(new{id="folder1",mimeType="application/vnd.google-apps.folder",trashed=false,capabilities=new{canAddChildren=true}});
            if(r.Method==HttpMethod.Get) return Completed?Json(new{id,size=size.ToString(),md5Checksum=md5,parents=new[]{"folder1"},trashed=false,appProperties=new{homeSecurityJob=jobId}}):new(HttpStatusCode.NotFound);
            if(r.Method==HttpMethod.Post) {
                Creates++; using var json=JsonDocument.Parse(await r.Content!.ReadAsStringAsync(ct));
                id=json.RootElement.GetProperty("id").GetString();jobId=json.RootElement.GetProperty("appProperties").GetProperty("homeSecurityJob").GetString();
                size=long.Parse(r.Headers.GetValues("X-Upload-Content-Length").Single());
                var response=new HttpResponseMessage(HttpStatusCode.OK);response.Headers.Location=new Uri("https://www.googleapis.com/upload/drive/v3/files?upload_id=secret-session");return response;
            }
            if(r.Content!.Headers.ContentRange?.From is null){StatusQueries++;var status=new HttpResponseMessage((HttpStatusCode)308);status.Headers.TryAddWithoutValidation("Range","bytes=0-"+(received-1));return status;}
            var data=await r.Content.ReadAsByteArrayAsync(ct);received+=data.Length; pieces.Write(data);
            if(LoseFirstChunk){LoseFirstChunk=false;throw new HttpRequestException("simulated lost intermediate response");}
            if(received==size){Completed=true;md5=Convert.ToHexString(MD5.HashData(pieces.ToArray()));throw new HttpRequestException("simulated lost final response");}
            var more=new HttpResponseMessage((HttpStatusCode)308);more.Headers.TryAddWithoutValidation("Range","bytes=0-"+(received-1));return more;
        }
        readonly MemoryStream pieces=new();
        protected override void Dispose(bool disposing){if(disposing)pieces.Dispose();base.Dispose(disposing);}
    }
}
