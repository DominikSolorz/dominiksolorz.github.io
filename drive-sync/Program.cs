using HomeSecurity.Agent;
using Microsoft.Data.Sqlite;
using System.Security.Cryptography;
using System.Text.Json;

var authorize=args.Length==3&&args[0]=="--authorize";
if((!authorize&&args.Length!=1)||!Path.IsPathFullyQualified(authorize?args[2]:args[0])) throw new ArgumentException("Absolute native configuration path required.");
var config=JsonSerializer.Deserialize<SyncConfig>(File.ReadAllText(authorize?args[2]:args[0])) ?? throw new ArgumentException("Missing configuration.");
if(!Path.IsPathFullyQualified(config.Folder)||!Directory.Exists(config.Folder)||config.IntegrationId==Guid.Empty)throw new ArgumentException("Invalid sync configuration.");
GoogleDriveApi.ValidateId(config.DriveFolderId);
var root=Path.GetFullPath(config.Folder);
var directory=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"HomeSecurityAgent");
if(authorize) {
 var nativeDb=new AgentDatabase(directory,recoverInterrupted:false);
 var nativeCredentials=new IntegrationCredentials(nativeDb,Path.Combine(directory,"integration-secrets"));
 using var authorizationLimit=new CancellationTokenSource(TimeSpan.FromMinutes(5));
 await GoogleDriveAuthorization.Authorize(Path.GetFullPath(args[1]),config.IntegrationId,nativeCredentials,authorizationLimit.Token);
 using var checkApi=new GoogleDriveApi(nativeCredentials);
 await checkApi.ValidateFolder(config.IntegrationId,config.DriveFolderId,authorizationLimit.Token);
 Console.WriteLine("GOOGLE_AUTHORIZATION_SAVED_AND_FOLDER_VERIFIED");return;
}
// Separate lock from the IPC agent: SQLite leases coordinate jobs; this lock prevents duplicate scanners.
using var scannerLock=new FileStream(Path.Combine(directory,"drive-sync.lock"),FileMode.OpenOrCreate,FileAccess.ReadWrite,FileShare.None);
var db=new AgentDatabase(directory,recoverInterrupted:false);
var credentials=new IntegrationCredentials(db,Path.Combine(directory,"integration-secrets"));
var queue=new DriveUploadQueue(db);
using var api=new GoogleDriveApi(credentials,sessionDirectory:Path.Combine(directory,"drive-sessions"));
var worker=new DriveUploadWorker(queue,api);
var statusFile=Path.Combine(directory,"drive-sync-status.json");
var observed=new Dictionary<string,(long Size,DateTime Stamp)>(StringComparer.OrdinalIgnoreCase);
var accepted=new Dictionary<string,(long Size,DateTime Stamp)>(StringComparer.OrdinalIgnoreCase);
var roots=new List<(string Path,bool Recovery)>{(root,false)};
if(config.RecoveryFolder is not null) {
 var expected=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"HomeSecurityDesktop","WebView","EBWebView","Default","IndexedDB","https_dominiksolorz.github.io_0.indexeddb.blob");
 if(!Path.GetFullPath(config.RecoveryFolder).Equals(expected,StringComparison.OrdinalIgnoreCase))throw new ArgumentException("Recovery is restricted to this app's recording blobs.");
 if(Directory.Exists(expected))roots.Add((expected,true));
}
DateTimeOffset nextPreflight=DateTimeOffset.MinValue;
bool ready=false;
using var stop=new CancellationTokenSource();
Console.CancelKeyPress+=(_,e)=>{e.Cancel=true;stop.Cancel();};
while(!stop.IsCancellationRequested) {
 string? error=null;int discovered=0;
 try {
  if(DateTimeOffset.UtcNow>=nextPreflight) {
   await api.ValidateFolder(config.IntegrationId,config.DriveFolderId,stop.Token);
   ready=true;nextPreflight=DateTimeOffset.UtcNow.AddMinutes(5);
   using var connection=Open();using var c=connection.CreateCommand();
   c.CommandText="SELECT id FROM drive_uploads WHERE integration_id=$integration AND folder_id=$folder AND status='blocked' AND code='GOOGLE_REAUTH_REQUIRED'";
   c.Parameters.AddWithValue("$integration",config.IntegrationId.ToString());c.Parameters.AddWithValue("$folder",config.DriveFolderId);
   var ids=new List<Guid>();using(var r=c.ExecuteReader())while(r.Read())ids.Add(Guid.Parse(r.GetString(0)));
   foreach(var id in ids)queue.ResumeBlocked(id);
  }
  if(ready) {
   var enumeration=new EnumerationOptions{RecurseSubdirectories=true,AttributesToSkip=FileAttributes.ReparsePoint,IgnoreInaccessible=false};
   foreach(var source in roots) foreach(var path in Directory.EnumerateFiles(source.Path,"*",enumeration)) {
    if(!source.Recovery&&!SyncRules.IsRecording(path))continue;
    var info=new FileInfo(path);
    if(info.LastWriteTime<config.FromLocalDate.Date||info.Length==0)continue;
    discovered++;
    var observation=(info.Length,info.LastWriteTimeUtc);
    if(accepted.TryGetValue(path,out var done)&&done==observation)continue;
    bool stable=observed.TryGetValue(path,out var previous)&&previous==observation;
    observed[path]=observation;
    if(!stable||DateTime.UtcNow-info.LastWriteTimeUtc<TimeSpan.FromSeconds(10))continue;
    try {
     using var input=DriveUploadQueue.OpenInput(path);
     if(source.Recovery) {
      var header=new byte[12];if(input.Read(header)!=header.Length||System.Text.Encoding.ASCII.GetString(header,4,4)!="ftyp")continue;
      input.Position=0;
     }
     var md5=Convert.ToHexString(await MD5.HashDataAsync(input,stop.Token));
     using var connection=Open();using var c=connection.CreateCommand();
     c.CommandText="SELECT COUNT(*) FROM drive_uploads WHERE integration_id=$integration AND folder_id=$folder AND path=$path COLLATE NOCASE AND size=$size AND md5=$md5";
     c.Parameters.AddWithValue("$integration",config.IntegrationId.ToString());c.Parameters.AddWithValue("$folder",config.DriveFolderId);
     c.Parameters.AddWithValue("$path",Path.GetFullPath(path));c.Parameters.AddWithValue("$size",input.Length);c.Parameters.AddWithValue("$md5",md5);
     var name=source.Recovery?$"kamera-odzyskane-{info.LastWriteTime:yyyy-MM-dd_HH-mm-ss}-{info.Name}.mp4":info.Name;
     if(Convert.ToInt64(c.ExecuteScalar())==0)queue.Enqueue(config.IntegrationId,path,config.DriveFolderId,name);
     accepted[path]=observation;
    } catch(IOException){ /* An active writer or transient file is retried next scan. */ }
    catch(ArgumentException){error="FILE_SIZE_UNSUPPORTED";}
   }
   await worker.RunOne(stop.Token);
  }
 } catch(DriveFailure failure) {
  error=failure.Code;ready=false;nextPreflight=DateTimeOffset.UtcNow.AddMinutes(1);
 } catch(Exception failure) when(failure is IOException or UnauthorizedAccessException or HttpRequestException or SqliteException or ArgumentException) {
  error=failure.GetType().Name;
 }
 using(var connection=Open()) {
  using var c=connection.CreateCommand();
  c.CommandText="SELECT status,COUNT(*) FROM drive_uploads WHERE integration_id=$integration AND folder_id=$folder AND name LIKE 'kamera-%' GROUP BY status";
  c.Parameters.AddWithValue("$integration",config.IntegrationId.ToString());c.Parameters.AddWithValue("$folder",config.DriveFolderId);
  var counts=new Dictionary<string,long>();using(var r=c.ExecuteReader())while(r.Read())counts[r.GetString(0)]=r.GetInt64(1);
  var status=new{updatedAt=DateTimeOffset.UtcNow,folder=root,driveFolderId=config.DriveFolderId,ready,error,discovered,counts,localFilesDeleted=false};
  File.WriteAllText(statusFile+".tmp",JsonSerializer.Serialize(status));File.Move(statusFile+".tmp",statusFile,true);
 }
 await Task.Delay(TimeSpan.FromSeconds(10),stop.Token);
}
SqliteConnection Open(){var c=new SqliteConnection(new SqliteConnectionStringBuilder{DataSource=Path.Combine(directory,"agent.db"),Mode=SqliteOpenMode.ReadWrite,DefaultTimeout=5,Pooling=false}.ToString());c.Open();return c;}
record SyncConfig(string Folder,Guid IntegrationId,string DriveFolderId,DateTime FromLocalDate,string? RecoveryFolder=null);
static class SyncRules {public static bool IsRecording(string path)=>Path.GetFileName(path).StartsWith("kamera-",StringComparison.OrdinalIgnoreCase)&&Path.GetExtension(path).ToLowerInvariant() is ".mp4" or ".webm";}
