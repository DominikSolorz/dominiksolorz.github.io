package pl.solorz.homesecurity;

import java.net.URI;

public final class NavigationPolicy {
    public static final String ORIGIN = "https://dominiksolorz.github.io";
    private NavigationPolicy() {}
    public static boolean isPanel(String value) {
        try {
            URI uri = new URI(value);
            return "https".equalsIgnoreCase(uri.getScheme())
                && "dominiksolorz.github.io".equalsIgnoreCase(uri.getHost())
                && uri.getRawUserInfo() == null && (uri.getPort() == -1 || uri.getPort() == 443)
                && new URI(null, null, uri.getPath(), null).normalize().getPath().startsWith("/kamera/");
        } catch (Exception ignored) { return false; }
    }
    public static String view(String name) {
        if (!name.equals("home") && !name.equals("recordings") && !name.equals("settings"))
            throw new IllegalArgumentException("Unknown panel view");
        return ORIGIN + "/kamera/panel.html?panel=owner&ui=phone&mobileView=" + name;
    }
    public static boolean isExternalHttps(String value) {
        try {
            URI uri = new URI(value);
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null && uri.getRawUserInfo() == null;
        } catch (Exception ignored) { return false; }
    }
}
