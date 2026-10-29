using HomeSecurity.Agent;
using Microsoft.Data.Sqlite;
using System.Text.Json;

static class RecordingStorageTests
{
    public static void Run(Action<bool,string> check,string root)
    {
        var storage=new RecordingStorage(root);var integration=Guid.NewGuid();
        var db=new AgentDatabase(root,false);
        new IntegrationCredentials(db,Path.Combine(root,"test-secrets")).ConfigureFake(integration,new byte[32]);
        check(storage.Read().Mode=="local"&&!storage.Read().Connected,"new installation does not inherit another user's Drive folder");
        bool denied=false;try{storage.Write(new("cloud"));}catch(ArgumentException){denied=true;}
        check(denied,"cloud mode rejected without connection");
        storage.Write(new("cloud",true,integration,"folder1"));
        var state=storage.Read();check(new RecordingStorage(root).Read()==state,"storage choice survives process restart");
        var payload=new byte[]{1,2,3,4};
        var id=storage.Begin("kamera-2026-10-29_20-00-00.mp4",payload.Length,state.Revision);
        check(storage.Append(id,0,payload)==4&&storage.Append(id,0,payload)==4,"chunk retry is idempotent and byte checked");
        denied=false;try{storage.Append(id,0,new byte[]{4,3,2,1});}catch(IOException){denied=true;}
        check(denied,"conflicting chunk rejected");
        var result=JsonSerializer.SerializeToElement(storage.Complete(id));var job=result.GetProperty("jobId").GetGuid();
        var spool=Path.Combine(root,"recording-spool");var file=Directory.GetFiles(spool,"*.pending").Single();
        storage.CleanupConfirmed();check(File.Exists(file),"unconfirmed recording is never removed from spool");
        using var connection=new SqliteConnection("Data Source="+Path.Combine(root,"agent.db"));connection.Open();using var command=connection.CreateCommand();
        command.CommandText="UPDATE drive_uploads SET status='succeeded',remote_id='remote1' WHERE id=$id";command.Parameters.AddWithValue("$id",job.ToString());command.ExecuteNonQuery();
        File.WriteAllBytes(file,new byte[]{5,6,7,8});storage.CleanupConfirmed();check(File.Exists(file),"modified local bytes are preserved despite old server receipt");
        File.WriteAllBytes(file,payload);storage.CleanupConfirmed();check(!File.Exists(file),"matching spool bytes removed only after verified queue success");
        id=storage.Begin("kamera-2026-10-29_20-01-00.mp4",payload.Length,state.Revision);storage.Append(id,0,payload);
        var restarted=new RecordingStorage(root);
        check(Directory.GetFiles(spool,"*.pending").Length==1,"complete transfer recovers after crash before queue acknowledgement");
        restarted.RecoverCompletedTransfers();
        command.CommandText="SELECT COUNT(*) FROM drive_uploads";check(Convert.ToInt32(command.ExecuteScalar())==2,"recovery does not duplicate upload jobs");
        restarted.Write(restarted.Read() with{Mode="local",Connected=false});
        check(Directory.GetFiles(spool,"*.pending").Length==1,"disconnect preserves pending recording");
        denied=false;try{restarted.Begin("../../evil.mp4",4,state.Revision);}catch(Exception e)when(e is ArgumentException or IOException){denied=true;}
        check(denied,"recording transfer rejects traversal and stale policy");
    }
}
