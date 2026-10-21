using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.Data.Sqlite;

namespace HomeSecurity.Agent;

public sealed record JobLease(Guid Id, string InputName, string Token, int Attempt);

// Native-only queue. No mutating command is exposed to web content.
public sealed class SyntheticJobs(AgentDatabase database, Func<DateTimeOffset>? clock = null)
{
    public void Enqueue(Guid id, string inputName, int maxAttempts = 3)
    {
        ValidateName(inputName);
        if (maxAttempts is < 1 or > 10) throw new ArgumentOutOfRangeException(nameof(maxAttempts));
        using var db = database.Open(); using var tx = db.BeginTransaction();
        using var c = db.CreateCommand(); c.Transaction = tx;
        c.CommandText = "SELECT fingerprint FROM jobs WHERE id=$id";
        c.Parameters.AddWithValue("$id", id.ToString());
        var fingerprint = inputName + ":" + maxAttempts;
        var existing = c.ExecuteScalar();
        if (existing is not null) { if ((string)existing != fingerprint) throw new InvalidOperationException("JOB_ID_CONFLICT"); return; }
        c.CommandText = "SELECT COUNT(*) FROM jobs";
        if (Convert.ToInt64(c.ExecuteScalar()) >= 10000) throw new JournalCapacityException();
        c.CommandText = "INSERT INTO jobs(id,fingerprint,input_name,status,max_attempts,next_at_ms,created_at_ms,updated_at_ms) VALUES($id,$fp,$name,'queued',$max,$now,$now,$now)";
        c.Parameters.AddWithValue("$fp", fingerprint); c.Parameters.AddWithValue("$name", inputName);
        var enqueuedAt = clock?.Invoke() ?? DateTimeOffset.UtcNow;
        c.Parameters.AddWithValue("$max", maxAttempts); c.Parameters.AddWithValue("$now", enqueuedAt.ToUnixTimeMilliseconds());
        c.ExecuteNonQuery(); History(db, tx, id, "queued", null, enqueuedAt); tx.Commit();
    }

    public JobLease? Claim(DateTimeOffset now)
    {
        using var db = database.Open(); using var tx = db.BeginTransaction();
        using var c = db.CreateCommand(); c.Transaction = tx;
        c.CommandText = "SELECT id,attempts,max_attempts FROM jobs WHERE status='running' AND lease_until_ms <= $now";
        c.Parameters.AddWithValue("$now", now.ToUnixTimeMilliseconds());
        var expired = new List<(Guid Id, bool Failed)>();
        using (var r = c.ExecuteReader()) while (r.Read()) expired.Add((Guid.Parse(r.GetString(0)), r.GetInt32(1) >= r.GetInt32(2)));
        foreach (var item in expired)
        {
            c.CommandText = "UPDATE jobs SET status=$status,lease_token=NULL,lease_until_ms=NULL,error_code='LEASE_EXPIRED',next_at_ms=$now,updated_at_ms=$now WHERE id=$id";
            c.Parameters.Clear(); c.Parameters.AddWithValue("$status", item.Failed ? "failed" : "retry_wait");
            c.Parameters.AddWithValue("$now", now.ToUnixTimeMilliseconds()); c.Parameters.AddWithValue("$id", item.Id.ToString()); c.ExecuteNonQuery();
            History(db, tx, item.Id, item.Failed ? "failed" : "retry_wait", "LEASE_EXPIRED", now);
        }
        c.Parameters.Clear(); c.Parameters.AddWithValue("$now", now.ToUnixTimeMilliseconds());
        c.CommandText = "SELECT id,input_name,attempts FROM jobs WHERE status IN ('queued','retry_wait') AND next_at_ms <= $now ORDER BY created_at_ms,id LIMIT 1";
        JobLease? lease = null;
        using (var r = c.ExecuteReader()) if (r.Read()) lease = new(Guid.Parse(r.GetString(0)), r.GetString(1), Guid.NewGuid().ToString("N"), r.GetInt32(2) + 1);
        if (lease is not null)
        {
            c.CommandText = "UPDATE jobs SET status='running',attempts=attempts+1,lease_token=$token,lease_until_ms=$until,updated_at_ms=$now WHERE id=$id";
            c.Parameters.AddWithValue("$id", lease.Id.ToString()); c.Parameters.AddWithValue("$token", lease.Token);
            c.Parameters.AddWithValue("$until", now.AddSeconds(30).ToUnixTimeMilliseconds()); c.ExecuteNonQuery();
            History(db, tx, lease.Id, "running", null, now);
        }
        tx.Commit(); return lease;
    }

    public bool Finish(JobLease lease, DateTimeOffset now, string? result, string? error = null)
    {
        using var db = database.Open(); using var tx = db.BeginTransaction(); using var c = db.CreateCommand(); c.Transaction = tx;
        c.CommandText = "UPDATE jobs SET status=CASE WHEN $error IS NULL THEN 'succeeded' WHEN attempts>=max_attempts THEN 'failed' ELSE 'retry_wait' END,result_json=$result,error_code=$error,lease_token=NULL,lease_until_ms=NULL,next_at_ms=$next,updated_at_ms=$now WHERE id=$id AND status='running' AND lease_token=$token AND lease_until_ms>$now RETURNING status";
        c.Parameters.AddWithValue("$error", (object?)error ?? DBNull.Value); c.Parameters.AddWithValue("$result", (object?)result ?? DBNull.Value);
        c.Parameters.AddWithValue("$next", now.AddSeconds(Math.Min(300, Math.Pow(2, lease.Attempt))).ToUnixTimeMilliseconds());
        c.Parameters.AddWithValue("$now", now.ToUnixTimeMilliseconds()); c.Parameters.AddWithValue("$id", lease.Id.ToString()); c.Parameters.AddWithValue("$token", lease.Token);
        var status = c.ExecuteScalar() as string;
        if (status is not null) History(db, tx, lease.Id, status, error, now);
        tx.Commit(); return status is not null;
    }

    public string? Status(Guid id)
    {
        using var db = database.Open(); using var c = db.CreateCommand();
        c.CommandText = "SELECT status FROM jobs WHERE id=$id"; c.Parameters.AddWithValue("$id", id.ToString()); return c.ExecuteScalar() as string;
    }
    private static void History(SqliteConnection db, SqliteTransaction tx, Guid id, string status, string? code, DateTimeOffset now)
    {
        using var c = db.CreateCommand(); c.Transaction = tx;
        c.CommandText = "INSERT INTO job_history(job_id,at_ms,status,code) VALUES($id,$now,$status,$code)";
        c.Parameters.AddWithValue("$id", id.ToString()); c.Parameters.AddWithValue("$now", now.ToUnixTimeMilliseconds());
        c.Parameters.AddWithValue("$status", status); c.Parameters.AddWithValue("$code", (object?)code ?? DBNull.Value); c.ExecuteNonQuery();
    }
    public static void ValidateName(string name)
    {
        if (name.Length is < 1 or > 100 || name.StartsWith('.') || name.EndsWith('.') ||
            name.Any(ch => !char.IsAsciiLetterOrDigit(ch) && ch is not '-' and not '_' and not '.'))
            throw new ArgumentException("Flat ASCII filename required.");
        var stem = name.Split('.')[0].ToUpperInvariant();
        if (stem is "CON" or "PRN" or "AUX" or "NUL" || stem.StartsWith("COM") || stem.StartsWith("LPT")) throw new ArgumentException("Reserved filename.");
    }
}

public sealed class SyntheticFileWorker
{
    private readonly SyntheticJobs jobs;
    public string Inbox { get; }
    public string Output { get; }
    public SyntheticFileWorker(SyntheticJobs jobs, string isolatedDirectory)
    {
        this.jobs = jobs;
        var root = Path.Combine(Path.GetFullPath(isolatedDirectory), "synthetic");
        Inbox = Path.Combine(root, "inbox"); Output = Path.Combine(root, "output");
        PrivateDirectory.Create(Inbox); PrivateDirectory.Create(Output);
        CheckDirectories();
    }
    private void CheckDirectories()
    {
        foreach (var path in new[] { Inbox, Output })
            for (var parent = new DirectoryInfo(path); parent is not null; parent = parent.Parent)
                if ((parent.Attributes & FileAttributes.ReparsePoint) != 0) throw new IOException("Reparse directory rejected.");
    }
    public async Task<bool> RunOneAsync(DateTimeOffset now, CancellationToken cancellation = default, Action? afterOutput = null, Action<string>? checkpoint = null)
    {
        var elapsed = System.Diagnostics.Stopwatch.StartNew();
        var lease = jobs.Claim(now); if (lease is null) return false;
        checkpoint?.Invoke("claimed");
        try
        {
            cancellation.ThrowIfCancellationRequested(); CheckDirectories(); SyntheticJobs.ValidateName(lease.InputName);
            var artifact = Path.Combine(Output, lease.Id.ToString("N") + ".json");
            // An existing durable artifact is the receipt for a crash before database completion.
            if (!File.Exists(artifact))
            {
                var input = Path.Combine(Inbox, lease.InputName);
                if ((File.GetAttributes(input) & FileAttributes.ReparsePoint) != 0) throw new IOException("Reparse file rejected.");
                await using var stream = new FileStream(input, FileMode.Open, FileAccess.Read, FileShare.Read);
                if (stream.Length > 16 * 1024 * 1024) throw new IOException("Input exceeds limit.");
                var hash = Convert.ToHexString(await SHA256.HashDataAsync(stream, cancellation));
                var bytes = JsonSerializer.SerializeToUtf8Bytes(new { jobId = lease.Id, inputName = lease.InputName, sha256 = hash, size = stream.Length });
                var temporary = Path.Combine(Output, lease.Id.ToString("N") + "." + lease.Token + ".tmp");
                using (var output = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None)) {
                    output.Write(bytes.AsSpan(0, bytes.Length / 2)); output.Flush(true);
                    checkpoint?.Invoke("partial");
                    output.Write(bytes.AsSpan(bytes.Length / 2)); output.Flush(true);
                }
                File.Move(temporary, artifact, false);
            }
            if ((File.GetAttributes(artifact) & FileAttributes.ReparsePoint) != 0) throw new IOException("Reparse receipt rejected.");
            if (new FileInfo(artifact).Length > 4096) throw new IOException("Receipt exceeds limit.");
            using var receipt = JsonDocument.Parse(await File.ReadAllTextAsync(artifact, cancellation));
            if (receipt.RootElement.GetProperty("jobId").GetGuid() != lease.Id || receipt.RootElement.GetProperty("inputName").GetString() != lease.InputName) throw new IOException("Invalid receipt.");
            afterOutput?.Invoke();
            checkpoint?.Invoke("receipt");
            jobs.Finish(lease, now.Add(elapsed.Elapsed), receipt.RootElement.GetRawText());
            checkpoint?.Invoke("completed");
        }
        catch (OperationCanceledException) { throw; } // Leave the lease for recovery, not a false terminal result.
        catch (Exception e) when (e is IOException or UnauthorizedAccessException or JsonException or InvalidOperationException or KeyNotFoundException)
        { jobs.Finish(lease, now.Add(elapsed.Elapsed), null, "FILE_WORK_FAILED"); }
        return true;
    }
}
