using HomeSecurity.Agent;
using HomeSecurity.Agent.Contracts;
using Microsoft.Data.Sqlite;

static class JobTests
{
    public static async Task RunAsync(Action<bool,string> check, string root)
    {
        var db = new AgentDatabase(root); var jobs = new SyntheticJobs(db);
        var worker = new SyntheticFileWorker(jobs, root);
        var now = DateTimeOffset.UtcNow.AddSeconds(1);
        var id = Guid.NewGuid(); jobs.Enqueue(id, "fixture.txt"); jobs.Enqueue(id, "fixture.txt");
        check(jobs.Status(id) == "queued", "durable enqueue and duplicate ID");
        var conflict = false; try { jobs.Enqueue(id, "other.txt"); } catch (InvalidOperationException) { conflict = true; }
        check(conflict, "job ID conflict rejected");
        await worker.RunOneAsync(now);
        check(jobs.Status(id) == "retry_wait", "missing file schedules retry");
        check(jobs.Claim(now.AddSeconds(1)) is null, "retry backoff enforced");
        await File.WriteAllTextAsync(Path.Combine(worker.Inbox, "fixture.txt"), "isolated synthetic input");
        await worker.RunOneAsync(now.AddSeconds(3));
        check(jobs.Status(id) == "succeeded", "file retry succeeds");
        check(File.Exists(Path.Combine(worker.Output, id.ToString("N") + ".json")), "durable receipt written");
        var crash = Guid.NewGuid(); jobs.Enqueue(crash, "fixture.txt");
        try { await worker.RunOneAsync(now, afterOutput: () => throw new SimulatedCrash()); } catch (SimulatedCrash) { }
        check(jobs.Status(crash) == "running", "crash between receipt and commit leaves lease");
        var reopened = new SyntheticJobs(new AgentDatabase(root));
        await new SyntheticFileWorker(reopened, root).RunOneAsync(now.AddSeconds(31));
        check(reopened.Status(crash) == "succeeded", "restart recovers durable receipt");
        check(Directory.GetFiles(worker.Output, crash.ToString("N") + "*.json").Length == 1, "recovery does not duplicate artifact");
        var fencing = Guid.NewGuid(); jobs.Enqueue(fencing, "fixture.txt");
        var old = jobs.Claim(now)!; var current = jobs.Claim(now.AddSeconds(31))!;
        check(!jobs.Finish(old, now.AddSeconds(32), "{}"), "stale worker fenced out");
        check(jobs.Finish(current, now.AddSeconds(32), "{}"), "current lease can finish");
        var fail = Guid.NewGuid(); jobs.Enqueue(fail, "missing.txt", 1);
        await worker.RunOneAsync(now);
        check(jobs.Status(fail) == "failed", "attempt limit produces terminal failure");
        var traversal = false; try { jobs.Enqueue(Guid.NewGuid(), "../escape"); } catch (ArgumentException) { traversal = true; }
        check(traversal, "worker path traversal rejected");
        var cancel = Guid.NewGuid(); jobs.Enqueue(cancel, "fixture.txt");
        using var stopped = new CancellationTokenSource(); stopped.Cancel();
        try { await worker.RunOneAsync(now, stopped.Token); } catch (OperationCanceledException) { }
        check(jobs.Status(cancel) == "running", "cancellation leaves recoverable lease");
        var command = Guid.NewGuid(); db.Begin(new(1, command, "agent.ping", AgentProtocol.Element(new {}), now), "fp");
        db.Complete(new(command, "succeeded"));
        check(db.RetainJournal(now.AddDays(31), TimeSpan.FromDays(30)) == 1 && db.Find(command)?.Reply.Code == "RESULT_EXPIRED", "retention preserves command tombstone");
        using var sql = new SqliteConnection("Data Source=" + Path.Combine(root, "agent.db")); sql.Open();
        using var query = sql.CreateCommand(); query.CommandText = "SELECT version FROM schema_version";
        check(Convert.ToInt32(query.ExecuteScalar()) == 2, "versioned schema migration");
        query.CommandText = "UPDATE schema_version SET version=999"; query.ExecuteNonQuery();
        var future = false; try { _ = new AgentDatabase(root); } catch (InvalidDataException) { future = true; }
        check(future, "future schema rejected without downgrade");
    }
    private sealed class SimulatedCrash : Exception;
}
