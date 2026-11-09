package pl.solorz.homesecurity;

import java.net.URI;
import java.util.Locale;

/** Decisions that must pass before offering an APK update. */
public final class UpdatePolicy {
    private UpdatePolicy() {}
    public static boolean trustedDownload(String value) {
        try {
            URI u = URI.create(value);
            return "https".equals(u.getScheme()) && "github.com".equals(u.getHost())
                && u.getPort() == -1 && u.getUserInfo() == null && u.getQuery() == null && u.getFragment() == null
                && u.getPath().startsWith("/DominikSolorz/dominiksolorz.github.io/releases/download/")
                && u.getPath().endsWith(".apk") && !u.getRawPath().contains("%") && !u.getPath().contains("/../");
        } catch (RuntimeException bad) { return false; }
    }
    public static boolean trustedTransport(String value) {
        try {
            URI u=URI.create(value);
            return "https".equals(u.getScheme()) && u.getUserInfo()==null && u.getPort()==-1
                && ("github.com".equals(u.getHost()) || "release-assets.githubusercontent.com".equals(u.getHost())
                    || "objects.githubusercontent.com".equals(u.getHost()));
        } catch(RuntimeException bad) { return false; }
    }
    public static boolean valid(String packageName, String expectedPackage, long version, long installed,
                                String url, String hash, long size) {
        return packageName.equals(expectedPackage) && version > installed && trustedDownload(url)
            && hash != null && hash.matches("[a-fA-F0-9]{64}") && size > 0 && size <= 64L*1024*1024;
    }
    public static String hex(byte[] bytes) {
        StringBuilder out=new StringBuilder();
        for(byte b:bytes) out.append(String.format(Locale.ROOT,"%02x",b&255));
        return out.toString();
    }
}
