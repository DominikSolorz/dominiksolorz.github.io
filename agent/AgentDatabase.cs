using System.Text.Json;
using HomeSecurity.Agent.Contracts;
using Microsoft.Data.Sqlite;

namespace HomeSecurity.Agent;

public sealed class AgentDatabase
{
    private readonly string connectionString;
    public AgentDatabase(string directory)
    {
        PrivateDirectory.Create(directory);
        connectionString = new SqliteConnectionStringBuilder {
            DataSource = Path.Combine(directory, "agent.db"), Mode = SqliteOpenMode.ReadWriteCreate,
            Pooling = false, DefaultTimeout = 5 }.ToString();
        using var db = Open(); using var command = db.CreateCommand();
        command.CommandText = """
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS schema_version(version INTEGER NOT NULL);
            INSERT INTO schema_version SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM schema_version);
            CREATE TABLE IF NOT EXISTS component_state(id TEXT PRIMARY KEY, json TEXT NOT NULL, updated_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS commands(id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, status TEXT NOT NULL,
                result_json TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS upload_jobs(id TEXT PRIMARY KEY, segment_id TEXT NOT NULL,
                integration_id TEXT NOT NULL, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT);
            CREATE TABLE IF NOT EXISTS segments(id TEXT PRIMARY KEY, camera_id TEXT NOT NULL, path TEXT NOT NULL,
                start_utc TEXT NOT NULL, end_utc TEXT, status TEXT NOT NULL, size_bytes INTEGER);
            """;
        command.ExecuteNonQuery();
        using var recovery = db.CreateCommand();
        recovery.CommandText = "UPDATE commands SET status='unknown', updated_at=$now WHERE status='executing'";
        recovery.Parameters.AddWithValue("$now", DateTimeOffset.UtcNow.ToString("O")); recovery.ExecuteNonQuery();
        SetState("agent", new { status = "ready", protocol = 1, mediaEngine = "not_implemented" });
    }
    private SqliteConnection Open() { var db = new SqliteConnection(connectionString); db.Open(); return db; }
    public void SetState(string id, object value)
    {
        using var db = Open(); using var command = db.CreateCommand();
        command.CommandText = "INSERT INTO component_state VALUES($id,$json,$now) ON CONFLICT(id) DO UPDATE SET json=$json,updated_at=$now";
        command.Parameters.AddWithValue("$id", id); command.Parameters.AddWithValue("$json", JsonSerializer.Serialize(value, AgentProtocol.Json));
        command.Parameters.AddWithValue("$now", DateTimeOffset.UtcNow.ToString("O")); command.ExecuteNonQuery();
    }
    public JsonElement Snapshot()
    {
        using var db = Open(); using var command = db.CreateCommand();
        command.CommandText = "SELECT id,json,updated_at FROM component_state";
        using var reader = command.ExecuteReader(); var states = new Dictionary<string, object>();
        while (reader.Read()) states[reader.GetString(0)] = new { state = JsonSerializer.Deserialize<JsonElement>(reader.GetString(1)), updatedAt = reader.GetString(2) };
        return AgentProtocol.Element(new { components = states });
    }
    public (string Fingerprint, AgentReply Reply)? Find(Guid id)
    {
        using var db = Open(); using var command = db.CreateCommand();
        command.CommandText = "SELECT fingerprint,status,result_json FROM commands WHERE id=$id";
        command.Parameters.AddWithValue("$id", id.ToString()); using var reader = command.ExecuteReader();
        if (!reader.Read()) return null;
        var status = reader.GetString(1);
        var reply = status == "unknown" || reader.IsDBNull(2) ? new AgentReply(id, status, "RECOVERY_OR_PENDING")
            : JsonSerializer.Deserialize<AgentReply>(reader.GetString(2), AgentProtocol.Json)!;
        return (reader.GetString(0), reply);
    }
    public void Begin(AgentCommand request, string fingerprint)
    {
        using var db = Open(); using var tx = db.BeginTransaction(); using var command = db.CreateCommand(); command.Transaction = tx;
        command.CommandText = "INSERT INTO commands VALUES($id,$fingerprint,'executing',NULL,$now,$now)";
        command.Parameters.AddWithValue("$id", request.Id.ToString()); command.Parameters.AddWithValue("$fingerprint", fingerprint);
        command.Parameters.AddWithValue("$now", DateTimeOffset.UtcNow.ToString("O")); command.ExecuteNonQuery(); tx.Commit();
    }
    public void Complete(AgentReply reply)
    {
        using var db = Open(); using var command = db.CreateCommand();
        command.CommandText = "UPDATE commands SET status=$status,result_json=$json,updated_at=$now WHERE id=$id";
        command.Parameters.AddWithValue("$id", reply.Id.ToString()); command.Parameters.AddWithValue("$status", reply.Status);
        command.Parameters.AddWithValue("$json", JsonSerializer.Serialize(reply, AgentProtocol.Json));
        command.Parameters.AddWithValue("$now", DateTimeOffset.UtcNow.ToString("O")); command.ExecuteNonQuery();
    }
}
