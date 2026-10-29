using System.Security.Cryptography;
using System.Text.Json;

namespace HomeSecurity.Agent;

public sealed record RecordingStoragePolicy(string Mode = "local", bool Connected = false,
    Guid IntegrationId = default, string? FolderId = null, long Revision = 0);

// This directory contains only new, closed recording segments. Never remove browser DB blobs or user archives.
public sealed class RecordingStorage
{
    private readonly string directory, policyFile, spool;
    private readonly AgentDatabase db;
    private readonly DriveUploadQueue queue;
    private readonly System.Collections.Concurrent.ConcurrentDictionary<Guid, Transfer> transfers = new();
    private sealed record Transfer(string Path, string Name, long Size, RecordingStoragePolicy Policy);
    public RecordingStorage(string directory)
    {
        this.directory = Path.GetFullPath(directory);
        PrivateDirectory.Create(this.directory);
        policyFile = Path.Combine(directory, "recording-storage.json");
        spool = Path.Combine(directory, "recording-spool");
        PrivateDirectory.Create(spool);
        db = new AgentDatabase(directory, recoverInterrupted: false);
        queue = new DriveUploadQueue(db);
        RecoverCompletedTransfers();
    }
    public RecordingStoragePolicy Read()
    {
        if (File.Exists(policyFile)) return JsonSerializer.Deserialize<RecordingStoragePolicy>(File.ReadAllText(policyFile)) ?? throw new IOException("STORAGE_POLICY_INVALID");
        // Existing installations keep their current local + Drive backup until the owner chooses otherwise.
        var legacy = Path.Combine(directory, "drive-sync.json");
        if (File.Exists(legacy))
        {
            using var json = JsonDocument.Parse(File.ReadAllText(legacy));
            var root = json.RootElement;
            if (root.TryGetProperty("IntegrationId", out var id) && Guid.TryParse(id.GetString(), out var integration)
                && root.TryGetProperty("DriveFolderId", out var folder))
                return new("both", true, integration, GoogleDriveApi.ValidateId(folder.GetString()!));
        }
        return new();
    }
    public void Write(RecordingStoragePolicy policy)
    {
        if (policy.Mode is not ("local" or "cloud" or "both") || (policy.Mode != "local" && !policy.Connected))
            throw new ArgumentException("CONNECT_DRIVE_FIRST");
        if (policy.Connected) { GoogleDriveApi.ValidateId(policy.FolderId!); if (policy.IntegrationId == Guid.Empty) throw new ArgumentException("INVALID_INTEGRATION"); }
        var next = policy with { Revision = Read().Revision + 1 };
        File.WriteAllText(policyFile + ".tmp", JsonSerializer.Serialize(next));
        File.Move(policyFile + ".tmp", policyFile, true);
    }
    public object Snapshot()
    {
        var policy = Read();
        using var connection = db.Open(); using var command = connection.CreateCommand();
        command.CommandText = "SELECT status,COUNT(*) FROM drive_uploads WHERE integration_id=$i AND folder_id=$f GROUP BY status";
        command.Parameters.AddWithValue("$i", policy.IntegrationId.ToString()); command.Parameters.AddWithValue("$f", policy.FolderId ?? "");
        var counts = new Dictionary<string, long>(); using (var rows = command.ExecuteReader()) while (rows.Read()) counts[rows.GetString(0)] = rows.GetInt64(1);
        return new { policy.Mode, policy.Connected, policy.FolderId, policy.Revision, counts, temporaryBytes = Directory.EnumerateFiles(spool).Sum(p => new FileInfo(p).Length) };
    }
    public Guid Begin(string name, long size, long revision)
    {
        var policy = Read();
        if (policy.Revision != revision || !policy.Connected || policy.Mode == "local") throw new IOException("STORAGE_POLICY_CHANGED");
        if (!System.Text.RegularExpressions.Regex.IsMatch(name, @"^kamera-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.(mp4|webm)$")
            || size is <= 0 or > 16L * 1024 * 1024 * 1024 || transfers.Count >= 2) throw new ArgumentException("INVALID_SEGMENT");
        var id = Guid.NewGuid(); var path = Path.Combine(spool, id.ToString("N") + ".partial");
        using (File.Create(path)) { }
        var transfer=new Transfer(path,name,size,policy);
        File.WriteAllText(path+".json",JsonSerializer.Serialize(transfer));
        transfers.TryAdd(id, transfer); return id;
    }
    public long Append(Guid id, long offset, byte[] bytes)
    {
        if (!transfers.TryGetValue(id, out var transfer) || bytes.Length is <= 0 or > 1048576) throw new ArgumentException("INVALID_TRANSFER");
        using var file = new FileStream(transfer.Path, FileMode.Open, FileAccess.Write, FileShare.None);
        // Offset makes retries harmless. A completed earlier write is acknowledged only if its bytes match.
        if (offset < file.Length && offset + bytes.Length == file.Length)
        {
            file.Dispose(); using var previous = File.OpenRead(transfer.Path); previous.Position = offset;
            var existing = new byte[bytes.Length]; previous.ReadExactly(existing);
            if (!existing.AsSpan().SequenceEqual(bytes)) throw new IOException("CHUNK_CONFLICT");
            return previous.Length;
        }
        if (offset != file.Length || offset + bytes.Length > transfer.Size) throw new IOException("CHUNK_OFFSET_INVALID");
        file.Position = offset; file.Write(bytes); file.Flush(true); return file.Length;
    }
    public object Complete(Guid id)
    {
        if (!transfers.TryGetValue(id, out var transfer)) throw new ArgumentException("INVALID_TRANSFER");
        if (new FileInfo(transfer.Path).Length != transfer.Size) throw new IOException("SEGMENT_INCOMPLETE");
        var final = Path.ChangeExtension(transfer.Path, ".pending");
        File.Move(transfer.Path, final);
        try
        {
            var job = EnqueueOnce(transfer,final);
            // Receipt survives restarts; only this exact spool file is eligible for later cleanup.
            File.WriteAllText(final + ".json", JsonSerializer.Serialize(new { job, path = final }));
            File.Delete(transfer.Path+".json");
            transfers.TryRemove(id,out _);
            return new { queued = true, name = transfer.Name, bytes = transfer.Size, jobId = job };
        }
        catch { if (File.Exists(final)) File.Move(final, transfer.Path); throw; }
    }
    private Guid EnqueueOnce(Transfer transfer,string path)
    {
        using var connection=db.Open();using var command=connection.CreateCommand();
        command.CommandText="SELECT id FROM drive_uploads WHERE path=$p AND size=$s AND integration_id=$i AND folder_id=$f LIMIT 1";
        command.Parameters.AddWithValue("$p",path);command.Parameters.AddWithValue("$s",transfer.Size);
        command.Parameters.AddWithValue("$i",transfer.Policy.IntegrationId.ToString());command.Parameters.AddWithValue("$f",transfer.Policy.FolderId!);
        return command.ExecuteScalar() is string existing?Guid.Parse(existing):queue.Enqueue(transfer.Policy.IntegrationId,path,transfer.Policy.FolderId!,transfer.Name);
    }
    public void RecoverCompletedTransfers()
    {
        foreach(var manifest in Directory.EnumerateFiles(spool,"*.partial.json"))
        {
            var transfer=JsonSerializer.Deserialize<Transfer>(File.ReadAllText(manifest))??throw new IOException("SPOOL_MANIFEST_INVALID");
            var path=manifest[..^5];
            // The manifest never grants access outside our private spool, even after manual corruption.
            if(transfer.Path!=path)throw new IOException("SPOOL_PATH_INVALID");
            var final=Path.ChangeExtension(path,".pending");
            if(File.Exists(path)&&new FileInfo(path).Length==transfer.Size)File.Move(path,final);
            if(!File.Exists(final)||new FileInfo(final).Length!=transfer.Size)continue;
            var job=EnqueueOnce(transfer,final);
            File.WriteAllText(final+".json",JsonSerializer.Serialize(new {job,path=final}));
            File.Delete(manifest);
        }
    }
    public void CleanupConfirmed()
    {
        foreach (var receipt in Directory.EnumerateFiles(spool, "*.pending.json"))
        {
            using var json = JsonDocument.Parse(File.ReadAllText(receipt));
            var job = json.RootElement.GetProperty("job").GetGuid();
            var path = receipt[..^5];
            using var connection = db.Open(); using var command = connection.CreateCommand();
            command.CommandText = "SELECT size,md5,path FROM drive_uploads WHERE id=$id AND status='succeeded' AND remote_id IS NOT NULL";
            command.Parameters.AddWithValue("$id", job.ToString());
            using var row = command.ExecuteReader(); if (!row.Read() || row.GetString(2) != path) continue;
            if (File.Exists(path))
            {
                using (var input = DriveUploadQueue.OpenInput(path))
                    if (input.Length != row.GetInt64(0) || Convert.ToHexString(MD5.HashData(input)) != row.GetString(1)) continue;
                File.Delete(path);
            }
            File.Delete(receipt);
        }
    }
    public void AbandonTransfers()
    {
        // Partial files remain for recovery after a navigation/crash; never acknowledge them as completed recordings.
        transfers.Clear();
    }
    public void Abort(Guid id) { transfers.TryRemove(id,out _); }
}
