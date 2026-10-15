namespace HomeSecurity.Agent;

public static class CrashTestHost
{
    public static async Task RunAsync(string[] args)
    {
        if (args.Length != 4 || !Path.IsPathFullyQualified(args[1]) ||
            args[2] is not ("queued" or "claimed" or "partial" or "receipt" or "completed" or "recover") ||
            !Guid.TryParse(args[3], out var id)) throw new ArgumentException("Invalid isolated harness arguments.");
        var root = Path.GetFullPath(args[1]);
        if (!Path.GetFileName(root).StartsWith("HomeSecurityCrash-", StringComparison.Ordinal) ||
            !File.Exists(Path.Combine(root, "test-only.marker"))) throw new ArgumentException("Test marker required.");
        using var instance = new FileStream(Path.Combine(root, "agent.lock"), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
        var jobs = new SyntheticJobs(new AgentDatabase(root));
        var worker = new SyntheticFileWorker(jobs, root);
        void Checkpoint(string stage) {
            if (stage != args[2]) return;
            Console.WriteLine("CHECKPOINT:" + stage); Console.Out.Flush();
            // Parent forcibly terminates this process; no graceful shutdown/finally.
            Thread.Sleep(Timeout.Infinite);
        }
        if (args[2] != "recover") {
            await File.WriteAllTextAsync(Path.Combine(worker.Inbox, "fixture.txt"), "crash-test-fixture");
            jobs.Enqueue(id, "fixture.txt"); Checkpoint("queued");
        }
        await worker.RunOneAsync(DateTimeOffset.UtcNow, checkpoint: Checkpoint);
        Console.WriteLine("STATUS:" + jobs.Status(id));
    }
}
