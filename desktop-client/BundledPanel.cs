using Microsoft.Web.WebView2.Core;

namespace HomeSecurityDesktop;

// Keep the existing origin so installing this release does not migrate or erase
// IndexedDB, the account session or the user's selected archive directory.
internal sealed class BundledPanel
{
    private readonly string root = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "Panel"));
    private static readonly Dictionary<string, string> Types = new(StringComparer.OrdinalIgnoreCase)
    {
        [".html"] = "text/html; charset=utf-8", [".js"] = "text/javascript; charset=utf-8",
        [".mjs"] = "text/javascript; charset=utf-8", [".css"] = "text/css; charset=utf-8",
        [".json"] = "application/json", [".webmanifest"] = "application/manifest+json",
        [".png"] = "image/png", [".jpg"] = "image/jpeg", [".jpeg"] = "image/jpeg",
        [".svg"] = "image/svg+xml", [".ico"] = "image/x-icon", [".webp"] = "image/webp",
        [".woff2"] = "font/woff2", [".wasm"] = "application/wasm"
    };

    internal void Attach(CoreWebView2 web)
    {
        if (!File.Exists(Path.Combine(root, "index.html")))
            throw new FileNotFoundException("Brak plików interfejsu. Zainstaluj ponownie HOME SECURITY.");
        web.AddWebResourceRequestedFilter("https://dominiksolorz.github.io/kamera/*", CoreWebView2WebResourceContext.All);
        web.WebResourceRequested += (_, e) =>
        {
            var uri = new Uri(e.Request.Uri);
            var relative = Uri.UnescapeDataString(uri.AbsolutePath["/kamera/".Length..]);
            // Only the explicitly separate distribution endpoints stay online.
            if (relative.StartsWith("updates/", StringComparison.Ordinal) ||
                relative.StartsWith("downloads/", StringComparison.Ordinal) || relative == "desktop-update.json") return;
            if (relative.Length == 0) relative = "index.html";
            var path = Path.GetFullPath(Path.Combine(root, relative.Replace('/', Path.DirectorySeparatorChar)));
            var safe = path.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) &&
                Types.ContainsKey(Path.GetExtension(path));
            if (e.Request.Method != "GET" || !safe || !File.Exists(path))
            {
                // Fail closed: never silently mix a newer website with this release.
                e.Response = web.Environment.CreateWebResourceResponse(null, 404, "Not Found", "Cache-Control: no-store");
                return;
            }
            e.Response = web.Environment.CreateWebResourceResponse(File.OpenRead(path), 200, "OK",
                $"Content-Type: {Types[Path.GetExtension(path)]}\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff");
        };
    }
}
