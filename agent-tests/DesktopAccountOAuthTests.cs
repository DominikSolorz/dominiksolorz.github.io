using System.Net;
using System.Text.Json;
using HomeSecurityDesktop;

internal static class DesktopAccountOAuthTests
{
    internal static async Task RunAsync(Action<bool, string> check)
    {
        var nonce = new string('N', 43);
        var url = DesktopAccountOAuth.AccountOrigin + "/auth/v1/authorize?provider=google&redirect_to=" + Uri.EscapeDataString(DesktopAccountOAuth.ReturnUrl) + "&code_challenge=" + nonce + "&code_challenge_method=s256";
        check(DesktopAccountOAuth.IsAuthorizeUrl(url), "Google PKCE endpoint accepted");
        foreach (var invalid in new[] { url.Replace("https://", "http://"), url.Replace("ksacbcrzuwdahnmggfxg.supabase.co", "evil.example"), url.Replace("s256", "plain"), url + "&provider=google", url + "&access_token=secret" })
            check(!DesktopAccountOAuth.IsAuthorizeUrl(invalid), "foreign or ambiguous OAuth request rejected");
        string Request(string state, string extra = "") => $"GET /oauth/callback?state={state}&code=one-use-code{extra} HTTP/1.1\r\nHost: 127.0.0.1:49152\r\n";
        check(DesktopAccountOAuth.TryCallback(Request(nonce),49152,nonce,out var code,out _) && code == "one-use-code", "bounded callback accepted");
        check(!DesktopAccountOAuth.TryCallback(Request(new string('X',43)),49152,nonce,out _,out _), "wrong nonce rejected");
        check(!DesktopAccountOAuth.TryCallback(Request(nonce,"&code=duplicate"),49152,nonce,out _,out _), "duplicate code rejected");
        check(!DesktopAccountOAuth.TryCallback(Request(nonce).Replace("GET ","POST "),49152,nonce,out _,out _), "POST rejected");
        using var bridge = new DesktopAccountOAuth(TimeSpan.FromSeconds(10));
        string? bootstrap = null;
        var pending = bridge.SignInAsync(url, value => bootstrap = value);
        check(bootstrap is not null, "system browser bootstrap created");
        var fragment = new Uri(bootstrap!).Fragment[1..].Replace('-','+').Replace('_','/');
        using var payload = JsonDocument.Parse(Convert.FromBase64String(fragment.PadRight((fragment.Length+3)/4*4,'=')));
        var port = payload.RootElement.GetProperty("port").GetInt32();
        var state = payload.RootElement.GetProperty("nonce").GetString();
        check((await bridge.SignInAsync(url,_=>{})).Error == "AUTH_ALREADY_RUNNING", "parallel sign-in rejected");
        using var http = new HttpClient(new HttpClientHandler { UseProxy = false });
        var wrong = await http.GetAsync($"http://127.0.0.1:{port}/oauth/callback?state={nonce}&code=one-use-code");
        check(wrong.StatusCode == HttpStatusCode.BadRequest, "real loopback rejects wrong nonce");
        var response = await http.GetAsync($"http://127.0.0.1:{port}/oauth/callback?state={state}&code=one-use-code");
        check(response.IsSuccessStatusCode && !(await response.Content.ReadAsStringAsync()).Contains("one-use-code"), "callback HTML contains no authorization code");
        check((await pending).Code == "one-use-code", "real one-use callback delivered");
        using var cancellation = new CancellationTokenSource();
        var cancelled = bridge.SignInAsync(url,_=>{},cancellation.Token);cancellation.Cancel();
        check((await cancelled).Error == "AUTH_CANCELLED", "cancel closes pending sign-in");
    }
}
