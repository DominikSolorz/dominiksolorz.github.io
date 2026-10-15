using System.Security.Cryptography;

namespace HomeSecurity.Agent;

// Metadata is safe for diagnostics. Neither credentials nor raw provider errors belong here.
public sealed record IntegrationMetadata(Guid IntegrationId, string Provider, string Status);
public sealed record IntegrationProbe(string Status, string? Code = null);

public sealed class IntegrationCredentials
{
    private readonly AgentDatabase database;
    private readonly SecretStore secrets;
    public IntegrationCredentials(AgentDatabase database, string secretDirectory)
    { this.database = database; secrets = new SecretStore(secretDirectory); }

    // Native provisioning only. Caller owns and must clear the incoming buffer.
    // Immutable encrypted revisions are written BEFORE the SQLite pointer is committed.
    public void ConfigureFake(Guid integrationId, byte[] credential)
        => Configure(integrationId, credential, "fake");
    internal void ConfigureDrive(Guid integrationId, byte[] credential)
        => Configure(integrationId, credential, "google_drive");
    private void Configure(Guid integrationId, byte[] credential, string provider)
    {
        if (integrationId == Guid.Empty) throw new ArgumentException("Integration ID required.");
        if (credential.Length is < 16 or > 16000) throw new ArgumentException("Credential size invalid.");
        var revision = Guid.NewGuid().ToString("N");
        var envelope = new byte[32 + credential.Length];
        integrationId.TryWriteBytes(envelope.AsSpan(0,16)); Guid.ParseExact(revision,"N").TryWriteBytes(envelope.AsSpan(16,16));
        credential.CopyTo(envelope,32);
        try { secrets.Save(revision, envelope); } finally { CryptographicOperations.ZeroMemory(envelope); }
        using var db = database.Open(); using var tx = db.BeginTransaction(); using var c = db.CreateCommand(); c.Transaction = tx;
        c.CommandText = "INSERT INTO integrations VALUES($id,$provider,$revision,'configured_unverified',$now) ON CONFLICT(id) DO UPDATE SET provider=$provider,revision=$revision,status='configured_unverified',updated_at=$now";
        c.Parameters.AddWithValue("$provider", provider);
        c.Parameters.AddWithValue("$id", integrationId.ToString()); c.Parameters.AddWithValue("$revision", revision);
        c.Parameters.AddWithValue("$now", DateTimeOffset.UtcNow.ToString("O")); c.ExecuteNonQuery(); tx.Commit();
    }
    public IntegrationMetadata? GetMetadata(Guid id) => Read(id)?.Metadata;
    internal string DriveRevision(Guid id) {
        var entry=Read(id);
        if(entry is null || entry.Value.Metadata.Provider!="google_drive" || entry.Value.Metadata.Status=="disabled")
            throw new DriveFailure("INTEGRATION_UNAVAILABLE",true);
        return entry.Value.Revision;
    }
    internal byte[] ResolveDrive(Guid id)
    {
        var entry = Read(id);
        if (entry is null || entry.Value.Metadata.Provider != "google_drive" || entry.Value.Metadata.Status == "disabled")
            throw new DriveFailure("INTEGRATION_UNAVAILABLE", blocked: true);
        byte[]? envelope = null;
        try {
            envelope = secrets.Read(entry.Value.Revision);
            if (envelope is null || envelope.Length < 48 || new Guid(envelope.AsSpan(0,16)) != id ||
                new Guid(envelope.AsSpan(16,16)).ToString("N") != entry.Value.Revision)
                throw new DriveFailure("SECRET_UNAVAILABLE", blocked: true);
            return envelope.AsSpan(32).ToArray();
        } catch (Exception e) when (e is CryptographicException or IOException or UnauthorizedAccessException or ArgumentException) {
            throw new DriveFailure("SECRET_UNREADABLE", blocked: true);
        } finally { if (envelope is not null) CryptographicOperations.ZeroMemory(envelope); }
    }
    private (IntegrationMetadata Metadata, string Revision)? Read(Guid id)
    {
        using var db = database.Open(); using var c = db.CreateCommand();
        c.CommandText = "SELECT provider,status,revision FROM integrations WHERE id=$id";
        c.Parameters.AddWithValue("$id", id.ToString()); using var r = c.ExecuteReader();
        return r.Read() ? (new(id, r.GetString(0), r.GetString(1)), r.GetString(2)) : null;
    }
    public void Disable(Guid id)
    {
        using var db = database.Open(); using var c = db.CreateCommand();
        c.CommandText = "UPDATE integrations SET status='disabled',updated_at=$now WHERE id=$id";
        c.Parameters.AddWithValue("$id", id.ToString()); c.Parameters.AddWithValue("$now", DateTimeOffset.UtcNow.ToString("O")); c.ExecuteNonQuery();
    }
    // Fake provider deliberately returns ONLY a status, never a secret or its hash.
    // It performs no HTTP calls and makes no claim about a real cloud account.
    public IntegrationProbe ProbeFake(Guid id)
    {
        var entry = Read(id);
        if (entry is null) return new("not_configured", "INTEGRATION_NOT_FOUND");
        if (entry.Value.Metadata.Status == "disabled") return new("disabled");
        if (entry.Value.Metadata.Provider != "fake") return new("not_applicable");
        byte[]? buffer = null;
        try
        {
            buffer = secrets.Read(entry.Value.Revision);
            if (buffer is null) return new("credential_unavailable", "SECRET_MISSING");
            if (buffer.Length < 48 || new Guid(buffer.AsSpan(0,16)) != id ||
                new Guid(buffer.AsSpan(16,16)).ToString("N") != entry.Value.Revision)
                return new("credential_unavailable", "SECRET_BINDING_INVALID");
            return new("fake_verified");
        }
        catch (Exception error) when (error is CryptographicException or IOException or UnauthorizedAccessException or ArgumentException)
        { return new("credential_unavailable", "SECRET_UNREADABLE"); }
        finally { if (buffer is not null) CryptographicOperations.ZeroMemory(buffer); }
    }
}
