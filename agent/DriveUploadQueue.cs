using System.Security.Cryptography;
using Microsoft.Data.Sqlite;

namespace HomeSecurity.Agent;

public sealed record DriveUpload(Guid Id,Guid IntegrationId,string Path,string FolderId,string Name,long Size,string Md5,
    string? RemoteId,string Lease,int Attempts);

public sealed class DriveUploadQueue(AgentDatabase database)
{
    public static FileStream OpenInput(string path)
    {
        if(!System.IO.Path.IsPathFullyQualified(path)) throw new ArgumentException("Absolute file required.");
        for(var d=new FileInfo(path).Directory;d is not null;d=d.Parent)
            if((d.Attributes&FileAttributes.ReparsePoint)!=0) throw new IOException("Reparse directory rejected.");
        if((File.GetAttributes(path)&FileAttributes.ReparsePoint)!=0) throw new IOException("Reparse file rejected.");
        var f=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.Read);
        if(f.Length is <=0 or > 16L*1024*1024*1024) { f.Dispose(); throw new ArgumentException("File must be 1 byte to 16 GiB."); }
        return f;
    }
    public Guid Enqueue(Guid integration,string path,string folder,string? recordingName=null)
    {
        GoogleDriveApi.ValidateId(folder); path=System.IO.Path.GetFullPath(path);
        var name=recordingName??System.IO.Path.GetFileName(path);
        if(string.IsNullOrWhiteSpace(name)||name.Length>240||System.IO.Path.GetFileName(name)!=name||name.IndexOfAny(System.IO.Path.GetInvalidFileNameChars())>=0)throw new ArgumentException("Invalid recording filename.");
        using var input=OpenInput(path); var md5=Convert.ToHexString(MD5.HashData(input)); var id=Guid.NewGuid();
        using var db=database.Open(); using var c=db.CreateCommand();
        c.CommandText="INSERT INTO drive_uploads(id,integration_id,path,folder_id,name,size,md5,status,next_ms,updated_ms) VALUES($id,$integration,$path,$folder,$name,$size,$md5,'queued',$now,$now)";
        c.Parameters.AddWithValue("$id",id.ToString()); c.Parameters.AddWithValue("$integration",integration.ToString());
        c.Parameters.AddWithValue("$path",path); c.Parameters.AddWithValue("$folder",folder); c.Parameters.AddWithValue("$name",name);
        c.Parameters.AddWithValue("$size",input.Length); c.Parameters.AddWithValue("$md5",md5); c.Parameters.AddWithValue("$now",DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        c.ExecuteNonQuery(); return id;
    }
    public DriveUpload? Claim(DateTimeOffset now)
    {
        using var db=database.Open(); using var tx=db.BeginTransaction(); using var c=db.CreateCommand(); c.Transaction=tx;
        c.Parameters.AddWithValue("$now",now.ToUnixTimeMilliseconds());
        c.CommandText="UPDATE drive_uploads SET status=CASE WHEN attempts>=10 THEN 'failed' ELSE 'retry_wait' END,code='LEASE_EXPIRED',lease=NULL,lease_until_ms=NULL,next_ms=$now WHERE status='running' AND lease_until_ms<=$now"; c.ExecuteNonQuery();
        c.CommandText="SELECT id,integration_id,path,folder_id,name,size,md5,remote_id,attempts FROM drive_uploads WHERE status IN ('queued','retry_wait') AND next_ms<=$now ORDER BY updated_ms,id LIMIT 1";
        DriveUpload? job=null;
        using(var r=c.ExecuteReader()) if(r.Read()) job=new(Guid.Parse(r.GetString(0)),Guid.Parse(r.GetString(1)),r.GetString(2),r.GetString(3),r.GetString(4),r.GetInt64(5),r.GetString(6),r.IsDBNull(7)?null:r.GetString(7),Guid.NewGuid().ToString("N"),r.GetInt32(8)+1);
        if(job is not null) {
            c.CommandText="UPDATE drive_uploads SET status='running',lease=$lease,lease_until_ms=$until,attempts=attempts+1,updated_ms=$now WHERE id=$id";
            c.Parameters.AddWithValue("$lease",job.Lease); c.Parameters.AddWithValue("$until",now.AddMinutes(5).ToUnixTimeMilliseconds()); c.Parameters.AddWithValue("$id",job.Id.ToString()); c.ExecuteNonQuery();
        }
        tx.Commit(); return job;
    }
    public void Renew(DriveUpload job) => Update(job,"lease_until_ms=$until",DateTimeOffset.UtcNow);
    public DriveUpload ReserveRemoteId(DriveUpload job,string remote)
    {
        GoogleDriveApi.ValidateId(remote);
        Update(job,"remote_id=COALESCE(remote_id,$remote)",DateTimeOffset.UtcNow,remote:remote);
        return job with { RemoteId=remote };
    }
    public void Finish(DriveUpload job,DriveFailure? error=null)
    {
        var status=error is null?"succeeded":error.Blocked?"blocked":error.Retry&&job.Attempts<10?"retry_wait":"failed";
        Update(job,"status=$status,code=$code,next_ms=$next,lease=NULL,lease_until_ms=NULL",DateTimeOffset.UtcNow,status,error?.Code);
    }
    private void Update(DriveUpload job,string set,DateTimeOffset now,string? status=null,string? code=null,string? remote=null)
    {
        using var db=database.Open(); using var c=db.CreateCommand();
        c.CommandText="UPDATE drive_uploads SET "+set+",updated_ms=$now WHERE id=$id AND status='running' AND lease=$lease AND lease_until_ms>$now";
        c.Parameters.AddWithValue("$id",job.Id.ToString()); c.Parameters.AddWithValue("$lease",job.Lease); c.Parameters.AddWithValue("$now",now.ToUnixTimeMilliseconds());
        c.Parameters.AddWithValue("$until",now.AddMinutes(5).ToUnixTimeMilliseconds());
        c.Parameters.AddWithValue("$next",now.AddSeconds(Math.Min(3600,Math.Pow(2,job.Attempts)*5)+Random.Shared.Next(0,5)).ToUnixTimeMilliseconds());
        c.Parameters.AddWithValue("$status",(object?)status??DBNull.Value); c.Parameters.AddWithValue("$code",(object?)code??DBNull.Value); c.Parameters.AddWithValue("$remote",(object?)remote??DBNull.Value);
        if(c.ExecuteNonQuery()!=1) throw new DriveFailure("LEASE_LOST",retry:true);
    }
    public void ResumeBlocked(Guid id)
    {
        using var db=database.Open(); using var c=db.CreateCommand();
        c.CommandText="UPDATE drive_uploads SET status='queued',attempts=0,next_ms=$now,updated_ms=$now,code=NULL WHERE id=$id AND status='blocked'";
        c.Parameters.AddWithValue("$id",id.ToString()); c.Parameters.AddWithValue("$now",DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()); c.ExecuteNonQuery();
    }
    public string? Status(Guid id)
    {
        using var db=database.Open(); using var c=db.CreateCommand(); c.CommandText="SELECT status FROM drive_uploads WHERE id=$id";
        c.Parameters.AddWithValue("$id",id.ToString()); return c.ExecuteScalar() as string;
    }
    public object? Details(Guid id)
    {
        using var db=database.Open();using var c=db.CreateCommand();
        c.CommandText="SELECT status,code,remote_id,attempts,folder_id FROM drive_uploads WHERE id=$id";
        c.Parameters.AddWithValue("$id",id.ToString());using var r=c.ExecuteReader();
        return r.Read()?new { jobId=id,status=r.GetString(0),code=r.IsDBNull(1)?null:r.GetString(1),
            remoteId=r.IsDBNull(2)?null:r.GetString(2),attempts=r.GetInt32(3),folderId=r.GetString(4) }:null;
    }
}

public sealed class DriveUploadWorker(DriveUploadQueue queue,GoogleDriveApi api)
{
    public async Task<bool> RunOne(CancellationToken ct=default)
    {
        var job=queue.Claim(DateTimeOffset.UtcNow); if(job is null) return false;
        try {
            using var file=DriveUploadQueue.OpenInput(job.Path);
            if(file.Length!=job.Size || Convert.ToHexString(await MD5.HashDataAsync(file,ct))!=job.Md5)
                throw new DriveFailure("LOCAL_FILE_CHANGED",true);
            file.Position=0; queue.Renew(job);
            if(job.RemoteId is null) job=queue.ReserveRemoteId(job,await api.GenerateId(job.IntegrationId,ct));
            await api.Upload(job,file,()=>queue.Renew(job),ct); queue.Finish(job);
        } catch(OperationCanceledException) when(ct.IsCancellationRequested) { throw; }
        catch(DriveFailure error) { TryFinish(job,error); }
        catch(Exception error) when(error is HttpRequestException or TaskCanceledException) { TryFinish(job,new("NETWORK_OR_TIMEOUT",retry:true)); }
        catch(Exception error) when(error is IOException or UnauthorizedAccessException or ArgumentException) { TryFinish(job,new("LOCAL_FILE_UNAVAILABLE",true)); }
        catch(Exception error) when(error is System.Text.Json.JsonException or KeyNotFoundException or InvalidOperationException) { TryFinish(job,new("GOOGLE_RESPONSE_INVALID",retry:true)); }
        return true;
    }
    private void TryFinish(DriveUpload job,DriveFailure failure) {
        try { queue.Finish(job,failure); } catch(DriveFailure stale) when(stale.Code=="LEASE_LOST") { }
    }
}
