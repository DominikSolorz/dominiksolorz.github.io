using System.Text.Json;
using HomeSecurity.Agent.Contracts;
using Microsoft.Data.Sqlite;

namespace HomeSecurity.Agent;

public sealed partial class AgentDatabase
{
    private readonly string connectionString;
    public AgentDatabase(string directory, bool recoverInterrupted = true)
    {
        PrivateDirectory.Create(directory);
        connectionString = new SqliteConnectionStringBuilder {
            DataSource = Path.Combine(directory, "agent.db"), Mode = SqliteOpenMode.ReadWriteCreate,
            Pooling = false, DefaultTimeout = 5 }.ToString();
        using var db = Open();
        Migrate(db);
        if (!recoverInterrupted) return;
        using var recovery = db.CreateCommand();
        recovery.CommandText = "UPDATE commands SET status='unknown', updated_at=$now WHERE status='executing'";
        recovery.Parameters.AddWithValue("$now", DateTimeOffset.UtcNow.ToString("O")); recovery.ExecuteNonQuery();
        SetState("agent", new { status = "ready", protocol = 1, mediaEngine = "not_implemented" });
    }
    internal SqliteConnection Open()
    {
        var db = new SqliteConnection(connectionString); db.Open();
        using var settings = db.CreateCommand();
        settings.CommandText = "PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL;";
        settings.ExecuteNonQuery(); return db;
    }
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
        var reply = status == "retained" ? new AgentReply(id, "unknown", "RESULT_EXPIRED")
            : status == "unknown" || reader.IsDBNull(2) ? new AgentReply(id, status, "RECOVERY_OR_PENDING")
            : JsonSerializer.Deserialize<AgentReply>(reader.GetString(2), AgentProtocol.Json)!;
        return (reader.GetString(0), reply);
    }
    public void Begin(AgentCommand request, string fingerprint)
    {
        using var db = Open(); using var tx = db.BeginTransaction(); using var command = db.CreateCommand(); command.Transaction = tx;
        command.CommandText = "SELECT COUNT(*) FROM commands";
        if (Convert.ToInt64(command.ExecuteScalar()) >= 100000) throw new JournalCapacityException();
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
