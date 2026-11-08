using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace HomeSecurityDesktop;

// Only a one-use PKCE authorization code crosses this loopback bridge. The
// verifier and account tokens stay in the initiating WebView2 auth client.
internal sealed class DesktopAccountOAuth : IDisposable
{
    internal const string AccountOrigin = "https://ksacbcrzuwdahnmggfxg.supabase.co";
    internal const string ReturnUrl = "https://dominiksolorz.github.io/kamera/";
    private readonly CancellationTokenSource lifetime = new();
    private readonly TimeSpan deadline;
    private int busy;
    internal DesktopAccountOAuth(TimeSpan? deadline = null) => this.deadline = deadline ?? TimeSpan.FromMinutes(3);
    internal sealed record Result(string? Code, string? Error);

    internal static bool TryQuery(string query, out Dictionary<string, string> values)
    {
        values = new(StringComparer.Ordinal);
        if (query.Length > 8192) return false;
        foreach (var field in query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var pair = field.Split('=', 2);
            var name = WebUtility.UrlDecode(pair[0]);
            var value = pair.Length == 2 ? WebUtility.UrlDecode(pair[1]) : "";
            if (values.Count >= 16 || !values.TryAdd(name, value)) return false;
        }
        return true;
    }
    internal static bool SafeCode(string? code) => code is { Length: >= 8 and <= 2048 }
        && code.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_' or '.' or '~');
    internal static bool SafeNonce(string? nonce) => nonce is { Length: 43 }
        && nonce.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_');
    internal static bool IsAuthorizeUrl(string value)
    {
        if (value.Length > 8192 || !Uri.TryCreate(value, UriKind.Absolute, out var uri)
            || uri.Scheme != "https" || uri.Port != 443 || uri.UserInfo.Length != 0 || uri.Fragment.Length != 0
            || uri.Host != "ksacbcrzuwdahnmggfxg.supabase.co" || uri.AbsolutePath != "/auth/v1/authorize"
            || !TryQuery(uri.Query, out var query)) return false;
        var allowed = new HashSet<string> { "provider", "redirect_to", "scopes", "code_challenge", "code_challenge_method", "skip_http_redirect", "prompt" };
        return query.Keys.All(allowed.Contains) && query.GetValueOrDefault("provider") == "google"
            && query.GetValueOrDefault("redirect_to") == ReturnUrl
            && SafeNonce(query.GetValueOrDefault("code_challenge"))
            && string.Equals(query.GetValueOrDefault("code_challenge_method"), "s256", StringComparison.OrdinalIgnoreCase);
    }
    internal static string BootstrapUrl(string url, string nonce, int port)
    {
        var payload = JsonSerializer.SerializeToUtf8Bytes(new { url, nonce, port });
        return ReturnUrl + "desktop-auth.html#" + Convert.ToBase64String(payload).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }
    internal async Task<Result> SignInAsync(string authorizeUrl, Action<string> openBrowser, CancellationToken cancellation = default)
    {
        if (!IsAuthorizeUrl(authorizeUrl)) return new(null, "AUTH_URL_REJECTED");
        if (Interlocked.CompareExchange(ref busy, 1, 0) != 0) return new(null, "AUTH_ALREADY_RUNNING");
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(lifetime.Token, cancellation);
        timeout.CancelAfter(deadline);
        var listener = new TcpListener(IPAddress.Loopback, 0);
        try
        {
            listener.Start();
            var port = ((IPEndPoint)listener.LocalEndpoint).Port;
            var nonce = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
            openBrowser(BootstrapUrl(authorizeUrl, nonce, port));
            while (!timeout.IsCancellationRequested)
            {
                using var client = await listener.AcceptTcpClientAsync(timeout.Token);
                try
                {
                    using var readDeadline = CancellationTokenSource.CreateLinkedTokenSource(timeout.Token);
                    readDeadline.CancelAfter(TimeSpan.FromSeconds(5));
                    var request = await ReadHeadersAsync(client.GetStream(), readDeadline.Token);
                    if (!TryCallback(request, port, nonce, out var code, out var error))
                    {
                        await RespondAsync(client, false, timeout.Token);
                        continue;
                    }
                    await RespondAsync(client, true, timeout.Token);
                    return new(code, error);
                }
                catch (Exception ex) when (ex is IOException or ArgumentException or OperationCanceledException)
                { if (timeout.IsCancellationRequested) break; }
            }
            return new(null, cancellation.IsCancellationRequested ? "AUTH_CANCELLED" : "AUTH_TIMEOUT");
        }
        catch (OperationCanceledException) { return new(null, cancellation.IsCancellationRequested ? "AUTH_CANCELLED" : "AUTH_TIMEOUT"); }
        catch (Exception ex) when (ex is SocketException or IOException or System.ComponentModel.Win32Exception or InvalidOperationException)
        { return new(null, "AUTH_BROWSER_UNAVAILABLE"); }
        finally { listener.Stop(); Interlocked.Exchange(ref busy, 0); }
    }
    internal static bool TryCallback(string request, int port, string nonce, out string? code, out string? error)
    {
        code = error = null;
        var lines = request.Split("\r\n", StringSplitOptions.None);
        if (lines.Length < 2 || lines.Length > 100 || request.Length > 8192) return false;
        var first = lines[0].Split(' ');
        if (first.Length != 3 || first[2] is not ("HTTP/1.1" or "HTTP/1.0") || first[0] != "GET" || !first[1].StartsWith('/') || first[1].StartsWith("//")) return false;
        var hosts = lines.Skip(1).Where(line => line.StartsWith("Host:", StringComparison.OrdinalIgnoreCase)).ToArray();
        if (hosts.Length != 1 || hosts[0][5..].Trim() != "127.0.0.1:" + port) return false;
        if (!Uri.TryCreate("http://127.0.0.1:" + port + first[1], UriKind.Absolute, out var uri)
            || uri.Host != "127.0.0.1" || uri.Port != port || uri.AbsolutePath != "/oauth/callback"
            || !TryQuery(uri.Query, out var values) || values.Keys.Any(key => key is not ("state" or "code" or "error"))) return false;
        var state = values.GetValueOrDefault("state");
        if (!SafeNonce(state) || !CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(state!), Encoding.ASCII.GetBytes(nonce))) return false;
        if (values.ContainsKey("error") && !values.ContainsKey("code")) { error = "AUTH_CANCELLED"; return true; }
        code = values.GetValueOrDefault("code");
        return SafeCode(code) && !values.ContainsKey("error");
    }
    private static async Task<string> ReadHeadersAsync(NetworkStream stream, CancellationToken cancellation)
    {
        var bytes = new byte[8192];
        var used = 0;
        while (used < bytes.Length)
        {
            var count = await stream.ReadAsync(bytes.AsMemory(used), cancellation);
            if (count == 0) throw new IOException("Incomplete HTTP header");
            used += count;
            var text = Encoding.ASCII.GetString(bytes, 0, used);
            var end = text.IndexOf("\r\n\r\n", StringComparison.Ordinal);
            if (end >= 0) return text[..end];
        }
        throw new IOException("HTTP header too large");
    }
    private static async Task RespondAsync(TcpClient client, bool accepted, CancellationToken cancellation)
    {
        const string page = "<!doctype html><html lang=\"pl\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>HOME SECURITY</title><h1>HOME SECURITY</h1><p>Możesz wrócić do programu HOME SECURITY i zamknąć tę kartę.</p></html>";
        var body = Encoding.UTF8.GetBytes(accepted ? page : "Invalid callback");
        var headers = Encoding.ASCII.GetBytes($"HTTP/1.1 {(accepted ? "200 OK" : "400 Bad Request")}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {body.Length}\r\nCache-Control: no-store\r\nReferrer-Policy: no-referrer\r\nContent-Security-Policy: default-src 'none'\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n");
        await client.GetStream().WriteAsync(headers, cancellation);
        await client.GetStream().WriteAsync(body, cancellation);
    }
    public void Dispose() { lifetime.Cancel(); }
}
