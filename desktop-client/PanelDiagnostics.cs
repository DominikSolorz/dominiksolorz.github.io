using System.Text.Json;

namespace HomeSecurityDesktop;

// An allowlist, not a blacklist: new message fields never become logs implicitly.
internal static class PanelDiagnostics
{
    internal static object? Project(string json)
    {
        if (json.Length > 16384) return null;
        try
        {
            using var outer = JsonDocument.Parse(json, new JsonDocumentOptions { MaxDepth = 8 });
            // Existing camera telemetry is posted as a JSON string by app.js.
            var payload = outer.RootElement.ValueKind == JsonValueKind.String
                ? outer.RootElement.GetString() : json;
            if (payload is null) return null;
            using var document = JsonDocument.Parse(payload, new JsonDocumentOptions { MaxDepth = 8 });
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object ||
                !root.TryGetProperty("type", out var type) || type.ValueKind != JsonValueKind.String ||
                type.GetString() != "camera-state") return null;
            var safe = new Dictionary<string, object> { ["type"] = "camera-state" };
            if (root.TryGetProperty("role", out var role) && role.ValueKind == JsonValueKind.String &&
                role.GetString() is "transmitter" or "webrtc") safe["role"] = role.GetString()!;
            foreach (var name in new[] { "live", "recording" })
                if (root.TryGetProperty(name, out var value) && value.ValueKind is JsonValueKind.True or JsonValueKind.False)
                    safe[name] = value.GetBoolean();
            foreach (var name in new[] { "at", "fps" })
                if (root.TryGetProperty(name, out var value) && value.TryGetFiniteNumber(out var number))
                    safe[name] = number;
            return safe;
        }
        catch (JsonException) { return null; }
    }

    private static bool TryGetFiniteNumber(this JsonElement value, out double number)
    {
        number = 0;
        return value.ValueKind == JsonValueKind.Number && value.TryGetDouble(out number) && double.IsFinite(number) && number >= 0;
    }
}
