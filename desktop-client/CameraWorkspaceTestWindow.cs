using System.Text;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace HomeSecurityDesktop;

// Isolated visual/integration test of the shipped component. No account session,
// IPC, devices or camera streams are opened. Fixture sources are never connected.
internal sealed class CameraWorkspaceTestWindow : Form
{
    private readonly WebView2 view = new() { Dock = DockStyle.Fill };
    internal CameraWorkspaceTestWindow(string resultFile)
    {
        Text = "HOME SECURITY — isolated camera workspace test";
        ClientSize = new Size(1500, 1050); ShowInTaskbar = false; Opacity = 0;
        Controls.Add(view);
        var deadline = new System.Windows.Forms.Timer { Interval = 40000 };
        deadline.Tick += (_, _) => { deadline.Stop(); File.WriteAllText(resultFile, "{\"ok\":false,\"error\":\"timeout\"}"); Close(); };
        FormClosed += (_, _) => deadline.Dispose();
        Shown += async (_, _) =>
        {
            deadline.Start();
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(resultFile)!);
                var profile = Path.Combine(Path.GetTempPath(), "HomeSecurity-CameraUiTest-" + Guid.NewGuid().ToString("N"));
                await view.EnsureCoreWebView2Async(await CoreWebView2Environment.CreateAsync(userDataFolder: profile));
                var web = view.CoreWebView2;
                new BundledPanel().Attach(web);
                web.PermissionRequested += (_, e) => e.State = CoreWebView2PermissionState.Deny;
                web.WebResourceRequested += (_, e) =>
                {
                    if (new Uri(e.Request.Uri).AbsolutePath != "/kamera/__camera_workspace_probe.html") return;
                    const string html = """
                    <!doctype html><html lang="pl" class="desktopMode"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
                    <link rel="stylesheet" href="style.css?v=184"><link rel="stylesheet" href="workspace-ui.css?v=13"><link rel="stylesheet" href="interface-theme.css?v=3"><link rel="stylesheet" href="interface-concept.css?v=2"><link rel="stylesheet" href="camera-workspace.css?v=1">
                    <body class="desktopMode"><aside class="desktopSidebar"><div class="desktopBrand"><img src="assets/ds-logo.jpg" width="45" height="50" alt="DS"><span><b>HOME SECURITY</b><small>DESKTOP · TEST UI</small></span></div><nav class="desktopNav"><button class="active">▦ Pulpit</button><button>◉ Sterowanie</button><button>♧ Alarmy</button><button>▷ Nagrania</button><button>⚙ Ustawienia</button><button>⌁ Diagnostyka</button></nav></aside>
                    <main id="app" style="margin-left:var(--desktop-sidebar);padding:22px;max-width:none;width:auto"><p style="font:12px system-ui;color:#cfaf73">TEST RZECZYWISTEGO KOMPONENTU · ŻADNE ŹRÓDŁO NIE JEST POŁĄCZONE</p><h1 style="font:650 29px system-ui;color:#f5f6f9;margin:0 0 20px">Pulpit monitoringu</h1><section class="desktopLiveScene" id="cameraRoot"></section></main>
                    <script type="module">
                    try {
                      const {createCameraCatalog}=await import('./core/camera-catalog.mjs?v=1');
                      const {mountCameraWorkspace}=await import('./camera-workspace.mjs?v=1');
                      const rows=new Map(),storage={getItem:k=>rows.get(k)||null,setItem:(k,v)=>rows.set(k,v)};
                      const ownerId='00000000-0000-4000-8000-000000000001';
                      const catalog=createCameraCatalog({storage,ownerId});
                      for(let i=1;i<=4;i++)catalog.add({name:'Kamera '+String(i+1).padStart(2,'0'),location:'Źródło testowe · bez obrazu',kind:'mjpeg',url:'https://camera.invalid/test/'+i});
                      const primary=document.createElement('article');primary.className='desktopCameraTile desktopCameraLive';
                      primary.innerHTML='<div class="desktopTileMeta"><strong>Kamera główna</strong><span>Brak podłączonego źródła · test UI</span></div><div id="stage" class="stage"><video id="video" hidden></video><div class="cameraSourcePlaceholder"><span>▣</span><strong>Brak obrazu</strong><small>W tym teście nie uruchamiamy urządzeń</small></div></div>';
                      const fixtureDevices={enumerateDevices:async()=>[{kind:'videoinput',deviceId:'fixture-primary',label:'Kamera główna (test)'},{kind:'videoinput',deviceId:'fixture-usb',label:'Dodatkowa kamera USB (test)'}],getUserMedia:async()=>{throw Error('Device access forbidden in UI test');}};
                      const workspace=mountCameraWorkspace({root:document.getElementById('cameraRoot'),primaryTile:primary,primaryVideo:primary.querySelector('video'),ownerId,storage,native:true,mediaDevices:fixtureDevices});
                      window.cameraWorkspaceProbe={workspace,primary};
                      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
                      const cards=[...document.querySelectorAll('.cameraWorkspaceGrid>article')].map(n=>n.getBoundingClientRect());
                      const overlaps=cards.some((a,i)=>cards.some((b,j)=>i!==j&&Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2));
                      window.chrome.webview.postMessage({phase:'grid',ok:!overlaps&&document.querySelectorAll('.cameraSourceTile').length===4&&document.querySelector('#video')===primary.querySelector('video')});
                    } catch {window.chrome.webview.postMessage({phase:'error',ok:false});}
                    </script></html>
                    """;
                    e.Response = web.Environment.CreateWebResourceResponse(new MemoryStream(Encoding.UTF8.GetBytes(html)), 200, "OK", "Content-Type: text/html; charset=utf-8\r\nCache-Control: no-store");
                };
                web.WebMessageReceived += async (_, e) =>
                {
                    if (new Uri(e.Source).AbsolutePath != "/kamera/__camera_workspace_probe.html") return;
                    try
                    {
                        using var doc = JsonDocument.Parse(e.WebMessageAsJson);
                        var phase = doc.RootElement.GetProperty("phase").GetString();
                        if (phase == "grid" && doc.RootElement.GetProperty("ok").GetBoolean())
                        {
                            await using (var image = File.Create(resultFile + "-grid.png")) await web.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
                            await web.ExecuteScriptAsync("""
                            (async()=>{const {workspace}=window.cameraWorkspaceProbe;
                            for(let i=5;i<=50;i++)workspace.catalog.add({name:'Kamera '+i,kind:'mjpeg',url:'https://camera.invalid/test/'+i});workspace.render();
                            await workspace.openSetup();
                            await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
                            window.chrome.webview.postMessage({phase:'dialog',ok:document.querySelector('dialog.cameraSetupDialog').open&&document.querySelectorAll('.cameraSourceTile').length===50&&document.querySelectorAll('.cameraWorkspaceGrid>article:not([hidden])').length===9,cameras:workspace.catalog.list().length,primaryRetained:document.querySelector('#video')===window.cameraWorkspaceProbe.primary.querySelector('video')});})();
                            """);
                            return;
                        }
                        if (phase == "dialog")
                        {
                            await using (var image = File.Create(resultFile + "-add.png")) await web.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
                        }
                        File.WriteAllText(resultFile, e.WebMessageAsJson); deadline.Stop(); Close();
                    }
                    catch { File.WriteAllText(resultFile, "{\"ok\":false,\"error\":\"render-test-failed\"}"); deadline.Stop(); Close(); }
                };
                web.Navigate("https://dominiksolorz.github.io/kamera/__camera_workspace_probe.html");
            }
            catch { File.WriteAllText(resultFile, "{\"ok\":false,\"error\":\"startup-failed\"}"); deadline.Stop(); Close(); }
        };
    }
}
