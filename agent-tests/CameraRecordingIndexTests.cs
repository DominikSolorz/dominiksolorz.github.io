using HomeSecurity.Agent;
using Microsoft.Data.Sqlite;

static class CameraRecordingIndexTests
{
    public static void Run(Action<bool,string> check, string parent)
    {
        var root = Path.Combine(parent,"camera-recording-index");
        var recordings = Path.Combine(root,"recordings");
        Directory.CreateDirectory(recordings);
        var db = new AgentDatabase(root, recoverInterrupted: false);
        var index = new CameraRecordingIndex(db, recordings);
        var t = new DateTimeOffset(2026, 11, 7, 12, 0, 0, TimeSpan.Zero);
        var cameras = Enumerable.Range(0, 50).Select(_ => Guid.NewGuid()).ToArray();
        var ids = new Dictionary<Guid,Guid>();
        for (var i=0;i<cameras.Length;i++)
        {
            var folder = Path.Combine(recordings,cameras[i].ToString("N"));
            Directory.CreateDirectory(folder);
            var filename = Path.Combine(folder,"clip-0001.mp4");
            File.WriteAllBytes(filename,[0,0,0,16,102,116,121,112,105,115,111,109]); // MP4 header fixture
            var id=Guid.NewGuid();
            ids.Add(cameras[i],id);
            var clip=index.RegisterClosed(id,cameras[i],filename,t,t.AddMinutes(10));
            check(clip.Available && clip.SizeBytes==12 && clip.CameraId==cameras[i],
                "registered closed recording belongs only to camera "+i);
        }
        check(index.Query(cameras[0],t,t.AddMinutes(10)).Count==1,
            "specific camera index includes its own closed segment");
        check(index.Query(Guid.NewGuid(),t,t.AddMinutes(10)).Count==0,
            "unregistered camera has no synthetic recordings");
        check(index.Query(cameras[0],t.AddMinutes(10),t.AddMinutes(15)).Count==0,
            "half-open recording boundary does not leak into next slot");
        check(index.Gaps(cameras[0],t,t.AddMinutes(30)).Count==1 &&
              index.Gaps(cameras[0],t,t.AddMinutes(30))[0].StartUtc==t.AddMinutes(10),
            "gaps are reported after the actual closed file ends");
        bool limitRejected=false;
        try { index.Gaps(cameras[0],t,t.AddMinutes(30),limit:1); }
        catch(InvalidOperationException){limitRejected=true;}
        check(limitRejected,"bounded queries cannot silently report unexamined clips as gaps");
        var file=Path.Combine(recordings,cameras[0].ToString("N"),"clip-0001.mp4");
        check(index.RegisterClosed(ids[cameras[0]],cameras[0],file,t,t.AddMinutes(10)).Id==ids[cameras[0]],
            "retry of the same closed segment is idempotent");
        bool rejected=false;
        try { index.RegisterClosed(ids[cameras[0]],cameras[1],file,t,t.AddMinutes(10)); }
        catch(InvalidOperationException){rejected=true;}
        check(rejected,"reuse of a recording ID by a different camera is rejected");
        rejected=false;
        try { index.RegisterClosed(Guid.NewGuid(),cameras[0],Path.Combine(parent,"outside.mp4"),t,t.AddMinutes(10)); }
        catch(ArgumentException){rejected=true;}
        check(rejected,"recording outside owner-selected root is rejected");
        rejected=false;
        try { index.RegisterClosed(Guid.NewGuid(),cameras[0],file,t,t); }
        catch(ArgumentException){rejected=true;}
        check(rejected,"zero-duration recording is rejected");
        rejected=false;
        try { index.Query(cameras[0],t.AddMinutes(1),t); }
        catch(ArgumentException){rejected=true;}
        check(rejected,"reversed timeline query is rejected");
        File.Delete(file);
        check(index.Query(cameras[0],t,t.AddMinutes(10))[0].Available==false,
            "missing physical file never appears as available, even if metadata remains");
        check(index.Gaps(cameras[0],t,t.AddMinutes(10)).Count==1,
            "missing file creates explicit unverified time gap, without deleting DB metadata");
        var restarted=new CameraRecordingIndex(new AgentDatabase(root,false),recordings);
        check(restarted.Query(cameras[1],t,t.AddMinutes(10)).Single().Available,
            "per-camera closed-file index survives process/database restart");
        using var sqlite = new SqliteConnection("Data Source="+Path.Combine(root,"agent.db"));
        sqlite.Open();
        using var cmd = sqlite.CreateCommand();
        cmd.CommandText="SELECT version FROM schema_version";
        check(Convert.ToInt32(cmd.ExecuteScalar())==5,"database schema migration 5 is applied");
        cmd.CommandText="SELECT COUNT(*) FROM segments";
        check(Convert.ToInt32(cmd.ExecuteScalar())==50,"50 camera metadata entries are durable");
        check(Directory.EnumerateFiles(recordings,"*.mp4",SearchOption.AllDirectories).Count()==49,
            "index never removes another camera's recording file");
    }
}
