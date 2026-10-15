using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using HomeSecurity.Agent;
using Microsoft.Data.Sqlite;

static class CredentialTests
{
    public static void Run(Action<bool,string> check, string root)
    {
        var db = new AgentDatabase(root); var secretRoot = Path.Combine(root,"integration-secrets");
        var provider = new IntegrationCredentials(db,secretRoot); var id = Guid.NewGuid();
        var secret = Encoding.UTF8.GetBytes("FAKE-ONLY-" + Guid.NewGuid().ToString("N"));
        try {
            check(provider.ProbeFake(id).Status == "not_configured", "unknown integration safe status");
            provider.ConfigureFake(id,secret);
            check(provider.GetMetadata(id)?.Status == "configured_unverified", "metadata does not claim real cloud connectivity");
            check(provider.ProbeFake(id).Status == "fake_verified", "DPAPI fake provider round trip");
            var files = Directory.GetFiles(secretRoot,"*.dpapi");
            check(files.Length == 1 && !Contains(File.ReadAllBytes(files[0]),secret), "encrypted revision contains no plaintext marker");
            check(!JsonSerializer.Serialize(provider.GetMetadata(id)).Contains(Encoding.UTF8.GetString(secret)), "metadata excludes credential");
            check(!Directory.GetFiles(root,"agent.db*").Any(p => Contains(File.ReadAllBytes(p),secret)), "SQLite database and WAL exclude secret");
            var reopened = new IntegrationCredentials(new AgentDatabase(root),secretRoot);
            check(reopened.ProbeFake(id).Status == "fake_verified", "integration survives database reopen");
            var orphan = new SecretStore(secretRoot); orphan.Save(Guid.NewGuid().ToString("N"),RandomNumberGenerator.GetBytes(48));
            check(reopened.ProbeFake(id).Status == "fake_verified", "unreferenced revision cannot replace current credential");
            provider.ConfigureFake(id,RandomNumberGenerator.GetBytes(32));
            check(provider.ProbeFake(id).Status == "fake_verified", "credential rotation switches committed revision");
            using var sql = new SqliteConnection("Data Source=" + Path.Combine(root,"agent.db")); sql.Open(); using var c = sql.CreateCommand();
            c.CommandText = "SELECT revision FROM integrations WHERE id=$id"; c.Parameters.AddWithValue("$id",id.ToString());
            var active = Path.Combine(secretRoot,(string)c.ExecuteScalar()! + ".dpapi");
            File.Copy(files[0],active,true);
            check(provider.ProbeFake(id).Code == "SECRET_BINDING_INVALID", "encrypted revision substitution rejected");
            File.WriteAllBytes(active,new byte[32]);
            check(provider.ProbeFake(id).Code == "SECRET_UNREADABLE", "corrupt DPAPI produces sanitized error");
            File.Delete(active);
            check(provider.ProbeFake(id).Code == "SECRET_MISSING", "missing credential is not authentication success");
            provider.Disable(id);
            check(provider.ProbeFake(id).Status == "disabled", "disabled integration cannot resolve credential");
            check(provider.ProbeFake(Guid.NewGuid()).Status == "not_configured", "integration IDs are isolated");
            var migrationRoot = Path.Combine(root,"schema2"); var old = new AgentDatabase(migrationRoot);
            old.SetState("migration-fixture",new { status="preserved" });
            using (var legacy = new SqliteConnection("Data Source=" + Path.Combine(migrationRoot,"agent.db"))) {
                legacy.Open(); using var fixture = legacy.CreateCommand();
                fixture.CommandText = "DROP TABLE drive_uploads; DROP TABLE integrations; UPDATE schema_version SET version=2"; fixture.ExecuteNonQuery();
            }
            var migrated = new AgentDatabase(migrationRoot);
            check(migrated.Snapshot().GetProperty("components").TryGetProperty("migration-fixture",out _), "schema 2 upgrade preserves existing state");
        } finally { CryptographicOperations.ZeroMemory(secret); }
    }
    private static bool Contains(byte[] haystack,byte[] needle) => haystack.AsSpan().IndexOf(needle) >= 0;
}
