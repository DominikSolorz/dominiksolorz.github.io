using System.Security.Cryptography;
using System.Text;
using HomeSecurity.Agent.Contracts;

namespace HomeSecurity.Agent;

public sealed class AgentDispatcher(AgentDatabase database)
{
    private readonly SemaphoreSlim serial = new(1, 1);
    public async Task<AgentReply> ExecuteAsync(AgentCommand request, CancellationToken ct)
    {
        if (request.Version != 1 || request.Id == Guid.Empty || !AgentProtocol.IsAllowed(request.Name, request.Args))
            return new(request.Id, "rejected", "INVALID_COMMAND");
        var fingerprint = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(request.Name + "\n" + request.Args.GetRawText())));
        await serial.WaitAsync(ct);
        try
        {
            var previous = database.Find(request.Id);
            if (previous is { } saved) return saved.Fingerprint == fingerprint ? saved.Reply : new(request.Id, "rejected", "ID_CONFLICT");
            if (request.ExpiresAt < DateTimeOffset.UtcNow || request.ExpiresAt > DateTimeOffset.UtcNow.AddMinutes(1))
                return new(request.Id, "rejected", "EXPIRED_OR_INVALID_DEADLINE");
            try { database.Begin(request, fingerprint); }
            catch (JournalCapacityException) { return new(request.Id, "rejected", "JOURNAL_CAPACITY_REACHED"); }
            AgentReply result;
            try
            {
                result = request.Name switch
                {
                    "agent.ping" => new(request.Id, "succeeded", Result: AgentProtocol.Element(new { protocol = 1, mediaEngine = "not_implemented" })),
                    "system.snapshot" => new(request.Id, "succeeded", Result: database.Snapshot()),
                    "command.status" => new(request.Id, "succeeded", Result: AgentProtocol.Element(
                        database.Find(Guid.Parse(request.Args.GetProperty("id").GetString()!))?.Reply ?? new AgentReply(Guid.Empty, "unknown", "NOT_FOUND"))),
                    _ => new(request.Id, "rejected", "NOT_IMPLEMENTED")
                };
            }
            catch { result = new(request.Id, "failed", "EXECUTION_ERROR"); }
            database.Complete(result); return result;
        }
        finally { serial.Release(); }
    }
}
