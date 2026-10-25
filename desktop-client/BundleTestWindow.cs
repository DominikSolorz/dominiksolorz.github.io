using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace HomeSecurityDesktop;

// Isolated integration probe: never loads application scripts, account storage
// or capture code. It only fetches installed static resources through WebView2.
internal sealed class BundleTestWindow : Form
{
    private readonly WebView2 view = new() { Dock = DockStyle.Fill };
    internal BundleTestWindow(string resultFile)
    {
        Text = "HOME SECURITY — test pakietu";
        ShowInTaskbar = false;
        Opacity = 0;
        Controls.Add(view);
        Shown += async (_, _) =>
        {
            try
            {
                var profile = Path.Combine(Path.GetTempPath(), "HomeSecurity-BundleTest-" + Guid.NewGuid().ToString("N"));
                await view.EnsureCoreWebView2Async(await CoreWebView2Environment.CreateAsync(userDataFolder: profile));
                var web = view.CoreWebView2;
                new BundledPanel().Attach(web);
                web.PermissionRequested += (_, e) => e.State = CoreWebView2PermissionState.Deny;
                web.WebResourceRequested += (_, e) =>
                {
                    if (new Uri(e.Request.Uri).AbsolutePath != "/kamera/__bundle_probe.html") return;
                    const string html = """
                    <!doctype html><title>Bundle probe</title><script>
                    (async()=>{try{
                      const files=['index.html','app.js','workspace-ui.css','interface-theme.css','core/client-layout.js','vendor/supabase.js','assets/ds-logo.jpg','o-systemie.html','support.css','support-entry.mjs','support-view.mjs','pomoc.html','marketing-contact.js'];
                      const checks=[];
                      for(const name of files){const r=await fetch(name);const b=await r.arrayBuffer();checks.push({name,status:r.status,bytes:b.byteLength});}
                      const missing=await fetch('__missing_bundle_file__.js');
                      const home=document.createElement('section');home.id='publicHome';document.body.append(home);
                      await import('./support-entry.mjs?v=1');
                      const launcher=home.querySelector('.hsSupportLauncher');launcher?.click();
                      const deadline=Date.now()+5000;
                      while(!home.querySelector('#hsSupportDialog')?.open && Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,25));
                      const supportMounted=!!home.querySelector('#hsSupportDialog')?.open;
                      const topics=home.querySelectorAll('#hsSupportTopic option').length;
                      window.chrome.webview.postMessage({ok:checks.every(x=>x.status===200&&x.bytes>0)&&missing.status===404&&supportMounted&&topics===6,checks,missing:missing.status,supportMounted,topics});
                    }catch(e){window.chrome.webview.postMessage({ok:false,error:String(e)});}})();
                    </script>
                    """;
                    e.Response = web.Environment.CreateWebResourceResponse(new MemoryStream(System.Text.Encoding.UTF8.GetBytes(html)), 200, "OK", "Content-Type: text/html");
                };
                var completed = new TaskCompletionSource<string>();
                web.WebMessageReceived += (_, e) =>
                {
                    if (e.Source == "https://dominiksolorz.github.io/kamera/__bundle_probe.html") completed.TrySetResult(e.WebMessageAsJson);
                };
                web.Navigate("https://dominiksolorz.github.io/kamera/__bundle_probe.html");
                File.WriteAllText(resultFile, await completed.Task.WaitAsync(TimeSpan.FromSeconds(30)));
            }
            catch (Exception ex) { File.WriteAllText(resultFile, System.Text.Json.JsonSerializer.Serialize(new { ok = false, error = ex.Message })); }
            finally { Close(); }
        };
    }
}
