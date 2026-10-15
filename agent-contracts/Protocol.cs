using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Text.Json;

namespace HomeSecurity.Agent.Contracts;

public sealed record AgentCommand(int Version, Guid Id, string Name, JsonElement Args, DateTimeOffset ExpiresAt);
public sealed record AgentReply(Guid Id, string Status, string? Code = null, JsonElement? Result = null);

public static class AgentProtocol
{
    public const int MaxFrameBytes = 65536;
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { MaxDepth = 16 };
    public static bool IsTrustedPanel(string source) => Uri.TryCreate(source, UriKind.Absolute, out var uri)
        && uri.Scheme == Uri.UriSchemeHttps && uri.Port == 443 && string.IsNullOrEmpty(uri.UserInfo)
        && uri.Host.Equals("dominiksolorz.github.io", StringComparison.OrdinalIgnoreCase)
        && uri.AbsolutePath is "/kamera/" or "/kamera/index.html";
    public static string PipeName => "HomeSecurity.Agent.v1." + Convert.ToHexString(
        SHA256.HashData(Encoding.UTF8.GetBytes(WindowsIdentity.GetCurrent().User!.Value)))[..24];
    public static string TestPipeName(string directory) => PipeName + ".test." +
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(Path.GetFullPath(directory).ToUpperInvariant())))[..16];
    public static JsonElement Element(object value) => JsonSerializer.SerializeToElement(value, Json);
    public static bool IsAllowed(string name, JsonElement args)
    {
        if (args.ValueKind != JsonValueKind.Object) return false;
        var properties = args.EnumerateObject().ToArray();
        return name switch
        {
            "agent.ping" or "system.snapshot" => properties.Length == 0,
            "command.status" => properties.Length == 1 && properties[0].Name == "id" &&
                properties[0].Value.ValueKind == JsonValueKind.String && Guid.TryParse(properties[0].Value.GetString(), out _),
            _ => false
        };
    }

    public static async Task WriteAsync<T>(Stream stream, T value, CancellationToken ct)
    {
        var data = JsonSerializer.SerializeToUtf8Bytes(value, Json);
        if (data.Length > MaxFrameBytes) throw new InvalidDataException("Frame too large.");
        var header = new byte[4]; BinaryPrimitives.WriteInt32LittleEndian(header, data.Length);
        await stream.WriteAsync(header, ct); await stream.WriteAsync(data, ct); await stream.FlushAsync(ct);
    }

    public static async Task<T> ReadAsync<T>(Stream stream, CancellationToken ct)
    {
        var header = new byte[4]; await stream.ReadExactlyAsync(header, ct);
        var length = BinaryPrimitives.ReadInt32LittleEndian(header);
        if (length is <= 0 or > MaxFrameBytes) throw new InvalidDataException("Invalid frame size.");
        var data = new byte[length]; await stream.ReadExactlyAsync(data, ct);
        return JsonSerializer.Deserialize<T>(data, Json) ?? throw new InvalidDataException("Invalid JSON.");
    }
}
