using Microsoft.Data.Sqlite;

namespace HomeSecurity.Agent;

public sealed class JournalCapacityException : Exception;

public sealed partial class AgentDatabase
{
    public const int CurrentSchema = 3;
    private static readonly string[] Migrations = [
        """
        CREATE TABLE component_state(id TEXT PRIMARY KEY, json TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE TABLE commands(id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, status TEXT NOT NULL,
            result_json TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE TABLE upload_jobs(id TEXT PRIMARY KEY, segment_id TEXT NOT NULL, integration_id TEXT NOT NULL,
            status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT);
        CREATE TABLE segments(id TEXT PRIMARY KEY, camera_id TEXT NOT NULL, path TEXT NOT NULL,
            start_utc TEXT NOT NULL, end_utc TEXT, status TEXT NOT NULL, size_bytes INTEGER);
        """,
        """
        CREATE TABLE jobs(id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, input_name TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('queued','running','retry_wait','succeeded','failed')),
            attempts INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL CHECK(max_attempts BETWEEN 1 AND 10),
            next_at_ms INTEGER NOT NULL, lease_token TEXT, lease_until_ms INTEGER,
            result_json TEXT, error_code TEXT, created_at_ms INTEGER NOT NULL, updated_at_ms INTEGER NOT NULL);
        CREATE INDEX jobs_ready ON jobs(status,next_at_ms);
        CREATE TABLE job_history(sequence INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL REFERENCES jobs(id),
            at_ms INTEGER NOT NULL, status TEXT NOT NULL, code TEXT);
        CREATE INDEX job_history_age ON job_history(at_ms);
        CREATE INDEX commands_age ON commands(status,updated_at);
        """,
        """
        CREATE TABLE integrations(id TEXT PRIMARY KEY, provider TEXT NOT NULL CHECK(provider='fake'),
            revision TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('configured_unverified','disabled')),
            updated_at TEXT NOT NULL);
        """
    ];
    private static void Migrate(SqliteConnection db)
    {
        using (var wal = db.CreateCommand()) { wal.CommandText = "PRAGMA journal_mode=WAL"; wal.ExecuteNonQuery(); }
        using var transaction = db.BeginTransaction();
        using var command = db.CreateCommand(); command.Transaction = transaction;
        command.CommandText = "CREATE TABLE IF NOT EXISTS schema_version(version INTEGER NOT NULL); SELECT version FROM schema_version";
        var versions = new List<int>();
        using (var reader = command.ExecuteReader()) { while (reader.Read()) versions.Add(reader.GetInt32(0)); }
        if (versions.Count > 1 || (versions.Count == 1 && (versions[0] < 1 || versions[0] > CurrentSchema)))
            throw new InvalidDataException("Unsupported or corrupt database schema; no downgrade attempted.");
        var version = versions.Count == 0 ? 0 : versions[0];
        for (var next = version + 1; next <= CurrentSchema; next++)
        {
            command.CommandText = Migrations[next - 1]; command.ExecuteNonQuery();
            command.CommandText = "DELETE FROM schema_version; INSERT INTO schema_version VALUES($version)";
            command.Parameters.Clear(); command.Parameters.AddWithValue("$version", next); command.ExecuteNonQuery();
        }
        transaction.Commit();
    }

    // Retencja usuwa treść wyniku, nie tożsamość komendy. Stare ID nie wykona działania ponownie.
    public int RetainJournal(DateTimeOffset now, TimeSpan age)
    {
        if (age < TimeSpan.Zero) throw new ArgumentOutOfRangeException(nameof(age));
        using var db = Open(); using var tx = db.BeginTransaction(); using var command = db.CreateCommand(); command.Transaction = tx;
        command.CommandText = "UPDATE commands SET status='retained',result_json=NULL WHERE status IN ('succeeded','failed','rejected') AND updated_at < $cutoff";
        command.Parameters.AddWithValue("$cutoff", now.Subtract(age).ToString("O"));
        var changed = command.ExecuteNonQuery();
        command.CommandText = "DELETE FROM job_history WHERE at_ms < $ms; UPDATE jobs SET result_json=NULL WHERE status IN ('succeeded','failed') AND updated_at_ms < $ms";
        command.Parameters.Clear(); command.Parameters.AddWithValue("$ms", now.Subtract(age).ToUnixTimeMilliseconds()); command.ExecuteNonQuery();
        tx.Commit(); return changed;
    }
}
