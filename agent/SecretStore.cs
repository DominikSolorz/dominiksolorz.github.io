using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;

namespace HomeSecurity.Agent;

public static class PrivateDirectory
{
    public static void Create(string path)
    {
        var security = new DirectorySecurity();
        security.SetAccessRuleProtection(true, false);
        var sid = WindowsIdentity.GetCurrent().User!;
        security.SetOwner(sid);
        security.AddAccessRule(new FileSystemAccessRule(sid, FileSystemRights.FullControl,
            InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit,
            PropagationFlags.None, AccessControlType.Allow));
        new DirectoryInfo(path).Create(security);
        new DirectoryInfo(path).SetAccessControl(security);
    }
}

// Tylko API natywne agenta. Brak odczytu/zapisu sekretów przez mostek WebView2.
public sealed class SecretStore
{
    private readonly string root;
    public SecretStore(string root) { this.root = root; PrivateDirectory.Create(root); }
    private string PathFor(string id)
    {
        if (string.IsNullOrEmpty(id) || id.Length > 64 || id.Any(c => !(char.IsAsciiLetterOrDigit(c) || c is '-' or '_')))
            throw new ArgumentException("Invalid secret identifier.");
        return Path.Combine(root, id + ".dpapi");
    }
    public void Save(string id, byte[] secret)
    {
        if (secret.Length is < 16 or > 16384) throw new ArgumentException("Invalid secret size.");
        var target = PathFor(id); var temporary = target + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            var encrypted = ProtectedData.Protect(secret, null, DataProtectionScope.CurrentUser);
            using (var file = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            { file.Write(encrypted); file.Flush(true); }
            File.Move(temporary, target, true);
        }
        finally { if (File.Exists(temporary)) File.Delete(temporary); }
    }
    // Wywołujący musi wyzerować otrzymany bufor po wykorzystaniu.
    public byte[]? Read(string id)
    {
        var path = PathFor(id);
        return File.Exists(path) ? ProtectedData.Unprotect(File.ReadAllBytes(path), null, DataProtectionScope.CurrentUser) : null;
    }
}
