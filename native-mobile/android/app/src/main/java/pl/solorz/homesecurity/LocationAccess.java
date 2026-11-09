package pl.solorz.homesecurity;

import android.Manifest;
import android.content.pm.PackageManager;
import android.webkit.GeolocationPermissions;
import android.widget.Toast;
import androidx.activity.ComponentActivity;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import java.util.function.Supplier;

/** Foreground permission bridge; no coordinates, background service or persistent web grant. */
final class LocationAccess {
    private final ComponentActivity activity;
    private final Supplier<String> activePage;
    private final ActivityResultLauncher<String[]> permissions;
    private GeolocationPermissions.Callback pending;
    private String origin, page;
    private boolean permissionRequestOpen;

    LocationAccess(ComponentActivity activity, Supplier<String> activePage) {
        this.activity = activity;
        this.activePage = activePage;
        permissions = activity.registerForActivityResult(new ActivityResultContracts.RequestMultiplePermissions(), result -> {
            permissionRequestOpen = false;
            if (pending == null) return;
            boolean granted = hasLocationPermission();
            finish(granted);
            if (!granted) Toast.makeText(activity, R.string.location_denied, Toast.LENGTH_LONG).show();
        });
    }

    void request(String requestingOrigin, GeolocationPermissions.Callback callback) {
        String current = activePage.get();
        if (permissionRequestOpen || !LocationPolicy.allowed(requestingOrigin, current)) {
            callback.invoke(requestingOrigin, false, false);
            return;
        }
        cancel();
        pending = callback;
        origin = requestingOrigin;
        page = current;
        if (hasLocationPermission()) { finish(true); return; }
        permissionRequestOpen = true;
        permissions.launch(new String[]{Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION});
    }

    private boolean hasLocationPermission() {
        return activity.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
            || activity.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void finish(boolean allow) {
        if (pending == null) return;
        GeolocationPermissions.Callback callback = pending;
        String requestedOrigin = origin;
        boolean samePage = page != null && page.equals(activePage.get());
        pending = null; origin = null; page = null;
        callback.invoke(requestedOrigin, allow && samePage && LocationPolicy.allowed(requestedOrigin, activePage.get()), false);
    }

    void cancel() { finish(false); }
}
