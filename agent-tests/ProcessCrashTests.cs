using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Data.Sqlite;

static class ProcessCrashTests
{
    public static async Task RunAsync(Action<bool,string> check, string agentDll)
    {
        foreach (var stage in new[] { "queued", "claimed", "partial", "receipt", "completed" })
        {
            var root = Path.Combine(Path.GetTempPath(), "HomeSecurityCrash-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(root); await File.WriteAllTextAsync(Path.Combine(root, "test-only.marker"), "isolated");
            var id = Guid.NewGuid();
            Process Start(string mode) {
                var start = new ProcessStartInfo("dotnet") { UseShellExecute = false, RedirectStandardOutput = true, RedirectStandardError = true, CreateNoWindow = true };
                foreach (var arg in new[] { agentDll, "--crash-harness", root, mode, id.ToString() }) start.ArgumentList.Add(arg);
                return Process.Start(start)!;
            }
            async Task<string> ReadBounded(Process child) {
                try {
                    var output = await child.StandardOutput.ReadToEndAsync().WaitAsync(TimeSpan.FromSeconds(20));
                    await child.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(10)); return output;
                } finally { if (!child.HasExited) { child.Kill(true); await child.WaitForExitAsync(); } }
            }
            using (var child = Start(stage)) {
                try {
                    var line = await child.StandardOutput.ReadLineAsync().WaitAsync(TimeSpan.FromSeconds(20));
                    check(line == "CHECKPOINT:" + stage, stage + ": child reached checkpoint");
                    child.Kill(entireProcessTree: true); await child.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(10));
                } finally { if (!child.HasExited) { child.Kill(true); await child.WaitForExitAsync(); } }
            }
            using var db = new SqliteConnection("Data Source=" + Path.Combine(root, "agent.db")); db.Open();
            using var c = db.CreateCommand();
            c.CommandText = "PRAGMA integrity_check"; check((string?)c.ExecuteScalar() == "ok", stage + ": SQLite integrity");
            c.CommandText = "PRAGMA foreign_key_check"; using (var r = c.ExecuteReader()) check(!r.Read(), stage + ": foreign keys");
            c.CommandText = "SELECT status FROM jobs"; var before = (string)c.ExecuteScalar()!;
            check(before == (stage == "queued" ? "queued" : stage == "completed" ? "succeeded" : "running"), stage + ": durable state");
            if (before == "running") {
                using var early = Start("recover");
                var output = await ReadBounded(early);
                check(early.ExitCode == 0 && output.Contains("STATUS:running"), stage + ": restart respects active lease");
                c.CommandText = "SELECT lease_until_ms FROM jobs";
                var remaining = Convert.ToInt64(c.ExecuteScalar()) - DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                if (remaining > 0) await Task.Delay(TimeSpan.FromMilliseconds(remaining + 100));
            }
            using (var recovered = Start("recover")) {
                var output = await ReadBounded(recovered);
                check(recovered.ExitCode == 0 && output.Contains("STATUS:succeeded"), stage + ": process recovery succeeded");
            }
            c.CommandText = "SELECT attempts FROM jobs";
            check(Convert.ToInt32(c.ExecuteScalar()) == (before == "running" ? 2 : 1), stage + ": exact attempt count");
            var files = Directory.GetFiles(Path.Combine(root, "synthetic", "output"), "*.json");
            using var receipt = JsonDocument.Parse(await File.ReadAllTextAsync(files.Single()));
            check(receipt.RootElement.GetProperty("sha256").GetString() == Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes("crash-test-fixture"))), stage + ": single correct artifact");
            Console.WriteLine("Crash evidence: " + root);
        }
    }
}
