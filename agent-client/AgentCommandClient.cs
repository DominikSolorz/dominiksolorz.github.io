using System.IO.Pipes;
using System.Text.Json;
using HomeSecurity.Agent.Contracts;

namespace HomeSecurity.Agent.Client;

public sealed class AgentCommandClient(string? pipeName = null)
{
    // Brak automatycznych ponowień: po przerwaniu odczytu wykonanie jest nieznane.
    public async Task<AgentReply> ExecuteAsync(string name, JsonElement args, Guid? id = null,
        TimeSpan? timeout = null, CancellationToken ct = default)
    {
        var commandId = id ?? Guid.NewGuid();
        var budget = timeout ?? TimeSpan.FromSeconds(5);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(ct);
        linked.CancelAfter(budget);
        try
        {
            using var pipe = new NamedPipeClientStream(".", pipeName ?? AgentProtocol.PipeName,
                PipeDirection.InOut, PipeOptions.Asynchronous | PipeOptions.CurrentUserOnly);
            await pipe.ConnectAsync(linked.Token);
            await AgentProtocol.WriteAsync(pipe, new AgentCommand(1, commandId, name, args,
                DateTimeOffset.UtcNow.Add(budget)), linked.Token);
            var reply = await AgentProtocol.ReadAsync<AgentReply>(pipe, linked.Token);
            if (reply.Id != commandId) return new(commandId, "unknown", "REPLY_ID_MISMATCH");
            if (reply.Status is not ("succeeded" or "rejected" or "failed" or "unknown"))
                return new(commandId, "unknown", "INVALID_REPLY");
            return reply;
        }
        catch (OperationCanceledException) { return new(commandId, "unknown", "TIMEOUT_OR_CANCELLED"); }
        catch (IOException) { return new(commandId, "unknown", "PIPE_UNAVAILABLE"); }
        catch (InvalidDataException) { return new(commandId, "unknown", "INVALID_REPLY"); }
        catch (UnauthorizedAccessException) { return new(commandId, "rejected", "PIPE_ACCESS_DENIED"); }
        catch (JsonException) { return new(commandId, "unknown", "INVALID_REPLY"); }
    }
}
