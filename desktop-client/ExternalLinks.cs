namespace HomeSecurityDesktop;

internal static class ExternalLinks
{
    internal static bool IsDriveFolder(string value)
    {
        if(!Uri.TryCreate(value,UriKind.Absolute,out var uri)||uri.Scheme!="https"||uri.Port!=443||uri.Host!="drive.google.com"||uri.UserInfo.Length!=0||uri.Query.Length!=0||uri.Fragment.Length!=0)return false;
        var parts=uri.AbsolutePath.Split('/',StringSplitOptions.RemoveEmptyEntries);
        return parts.Length==3&&parts[0]=="drive"&&parts[1]=="folders"&&parts[2].Length is >=10 and <=200&&parts[2].All(c=>char.IsAsciiLetterOrDigit(c)||c is '-' or '_');
    }
}
