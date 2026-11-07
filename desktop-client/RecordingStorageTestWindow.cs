using HomeSecurity.Agent;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.Text.Json;

namespace HomeSecurityDesktop;

// Isolated real WebView2 -> native bridge -> durable spool, without camera, credentials or user's data.
internal sealed class RecordingStorageTestWindow : Form
{
    private readonly WebView2 view=new(){Dock=DockStyle.Fill};
    private readonly string report;
    private RecordingStorageBridge? bridge;
    internal RecordingStorageTestWindow(string report)
    {
        this.report=report;Controls.Add(view);ClientSize=new(850,600);ShowInTaskbar=false;Opacity=0;Text="HOME SECURITY — test zapisu bez kamery";
        Shown+=async(_,_)=>{try{await Run();}catch(Exception error){Save(new{ok=false,error=error.GetType().Name});Close();}};
        FormClosed+=(_,_)=>bridge?.Dispose();
    }
    private void Save(object result)=>File.WriteAllText(report,JsonSerializer.Serialize(result));
    private async Task Run()
    {
        Save(new{ok=false,phase="initializing"});
        var root=Path.Combine(Path.GetTempPath(),"HomeSecurity-storage-bridge-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(root);
        var storage=new RecordingStorage(root);var integration=Guid.NewGuid();
        new IntegrationCredentials(new AgentDatabase(root,false),Path.Combine(root,"integration-secrets")).ConfigureFake(integration,new byte[32]);
        storage.Write(new("cloud",true,integration,"folder123456"));
        Save(new{ok=false,phase="creating-webview-environment"});
        var env=await CoreWebView2Environment.CreateAsync(userDataFolder:Path.Combine(root,"webview"));
        Save(new{ok=false,phase="creating-webview-control"});await view.EnsureCoreWebView2Async(env);
        Save(new{ok=false,phase="loading-test-document"});
        var web=view.CoreWebView2;const string document="https://dominiksolorz.github.io/kamera/__recording_storage_probe.html";
        new BundledPanel().Attach(web);
        web.PermissionRequested+=(_,args)=>args.State=CoreWebView2PermissionState.Deny;
        web.AddWebResourceRequestedFilter(document,CoreWebView2WebResourceContext.Document);
        const string html="""
        <!doctype html><html lang="pl"><meta charset="utf-8"><title>Test bufora</title><body>Testuję prawdziwy mostek zapisu…<script type="module">
        let client;
        try {
          const {RecordingStorageClient}=await import('./recording-storage.mjs');
          client=new RecordingStorageClient(chrome.webview);
          const state=await client.refresh();
          const data=new Uint8Array(1048613);data[0]=17;data[data.length-1]=213;
          const result=await client.save(new Blob([data]),'kamera-2026-10-29_20-01-00.mp4',state);
          await client.request('disconnect');const stopped=await client.refresh();
          chrome.webview.postMessage({type:'storage-test.report',report:{ok:result.queued&&result.bytes===data.length&&stopped.mode==='local'&&!stopped.connected,bytes:result.bytes,mode:stopped.mode}});
        }catch(error){chrome.webview.postMessage({type:'storage-test.report',report:{ok:false,error:error.message}});}finally{client?.dispose();}
        </script></body></html>
        """;
        web.WebResourceRequested+=(_,args)=>{if(args.Request.Uri==document)args.Response=web.Environment.CreateWebResourceResponse(new MemoryStream(System.Text.Encoding.UTF8.GetBytes(html)),200,"OK","Content-Type: text/html; charset=utf-8");};
        bridge=RecordingStorageBridge.CreateForTest(web,()=>true,root,document);
        web.WebMessageReceived+=(_,args)=>{
            if(args.Source!=document)return;
            using var json=JsonDocument.Parse(args.WebMessageAsJson);
            if(json.RootElement.GetProperty("type").GetString()!="storage-test.report")return;
            var value=json.RootElement.GetProperty("report");
            if(!value.GetProperty("ok").GetBoolean()){Save(value.Clone());Close();return;}
            var path=Directory.GetFiles(Path.Combine(root,"recording-spool"),"*.pending").Single();var bytes=File.ReadAllBytes(path);
            Save(new{ok=value.GetProperty("ok").GetBoolean()&&bytes.Length==1048613&&bytes[0]==17&&bytes[^1]==213,bridge=value.Clone(),spoolBytes=bytes.Length,preservedAfterDisconnect=File.Exists(path)});Close();
        };
        web.Navigate(document);
        var deadline=new System.Windows.Forms.Timer{Interval=45000};deadline.Tick+=(_,_)=>{deadline.Stop();Close();};deadline.Start();
    }
}
