package pl.solorz.homesecurity;

import java.net.URI;

/** Geolocation is only available to the HTTPS owner panel, never another frame origin. */
final class LocationPolicy {
    private LocationPolicy() {}
    static boolean allowed(String origin, String activePage) {
        if (!NavigationPolicy.isPanel(activePage)) return false;
        try {
            URI uri = new URI(origin);
            return "https".equalsIgnoreCase(uri.getScheme())
                && "dominiksolorz.github.io".equalsIgnoreCase(uri.getHost())
                && uri.getRawUserInfo() == null && (uri.getPort() == -1 || uri.getPort() == 443)
                && (uri.getRawPath().isEmpty() || "/".equals(uri.getRawPath()))
                && uri.getRawQuery() == null && uri.getRawFragment() == null;
        } catch (Exception invalid) { return false; }
    }
}
