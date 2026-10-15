namespace HomeSecurity.Agent;

public static class DriveNativeCommands
{
    public static async Task Run(string[] args,string directory)
    {
        PrivateDirectory.Create(directory);
        using var instance=new FileStream(Path.Combine(directory,"agent.lock"),FileMode.OpenOrCreate,FileAccess.ReadWrite,FileShare.None);
        var db=new AgentDatabase(directory); var credentials=new IntegrationCredentials(db,Path.Combine(directory,"integration-secrets"));
        var queue=new DriveUploadQueue(db);
        using var stop=new CancellationTokenSource(); Console.CancelKeyPress+=(_,e)=>{e.Cancel=true;stop.Cancel();};
        try {
            switch(args[0]) {
                case "--drive-authorize" when args.Length==3:
                    await GoogleDriveAuthorization.Authorize(Path.GetFullPath(args[2]),Guid.Parse(args[1]),credentials,stop.Token);
                    Console.WriteLine("Google Drive: authorization saved using DPAPI."); break;
                case "--drive-authorize-full" when args.Length==3:
                    Console.WriteLine("WARNING: full Drive scope grants access to ALL files, not just the upload folder. Prefer drive.file with an app-authorized folder. Type ALLOW_ALL_FILES to continue; otherwise cancel.");
                    if(Console.ReadLine()!="ALLOW_ALL_FILES") throw new DriveFailure("BROAD_SCOPE_NOT_APPROVED",true);
                    await GoogleDriveAuthorization.Authorize(Path.GetFullPath(args[2]),Guid.Parse(args[1]),credentials,stop.Token,fullDrive:true);
                    Console.WriteLine("Google Drive: full-scope authorization saved using DPAPI."); break;
                case "--drive-enqueue" when args.Length==4:
                    Console.WriteLine("Job: "+queue.Enqueue(Guid.Parse(args[1]),args[2],args[3])); break;
                case "--drive-status" when args.Length==2:
                    Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(queue.Details(Guid.Parse(args[1])))); break;
                case "--drive-resume" when args.Length==2:
                    queue.ResumeBlocked(Guid.Parse(args[1])); Console.WriteLine("Blocked job released for retry."); break;
                case "--drive-worker" when args.Length==1:
                    using(var api=new GoogleDriveApi(credentials,sessionDirectory:Path.Combine(directory,"drive-sessions"))) {
                        var worker=new DriveUploadWorker(queue,api);
                        while(!stop.IsCancellationRequested) {
                            await worker.RunOne(stop.Token); await Task.Delay(1000,stop.Token);
                        }
                    } break;
                default: throw new ArgumentException("Invalid native Drive command arguments.");
            }
        } catch(DriveFailure error) { Console.Error.WriteLine(error.Code); Environment.ExitCode=2; }
        catch(OperationCanceledException) { Console.Error.WriteLine("Operation cancelled; leases remain recoverable."); }
        catch(Exception error) when(error is IOException or ArgumentException or System.Text.Json.JsonException or KeyNotFoundException or UnauthorizedAccessException or HttpRequestException or System.Security.Cryptography.CryptographicException or InvalidOperationException) {
            Console.Error.WriteLine("DRIVE_CONFIGURATION_OR_INPUT_ERROR"); Environment.ExitCode=2;
        }
    }
}
