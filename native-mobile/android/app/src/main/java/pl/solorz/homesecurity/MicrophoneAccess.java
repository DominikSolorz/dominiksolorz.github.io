package pl.solorz.homesecurity;

import android.Manifest;
import android.content.pm.PackageManager;
import android.webkit.PermissionRequest;
import androidx.activity.ComponentActivity;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;

/**
 * Mikrofon telefonu dla rozmowy „telefon → komputer”.
 * Udostępniany wyłącznie oficjalnej stronie HOME SECURITY, wyłącznie jako
 * dźwięk (bez kamery telefonu) i dopiero po systemowej zgodzie Androida.
 */
final class MicrophoneAccess {
    private final ComponentActivity activity;
    private final ActivityResultLauncher<String> ask;
    private PermissionRequest pending;

    MicrophoneAccess(ComponentActivity activity) {
        this.activity = activity;
        // Rejestracja przed onCreate/STARTED jest wymagana przez Activity Result API.
        this.ask = activity.registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> {
            PermissionRequest request = pending;
            pending = null;
            if (request == null) return;
            if (granted) request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
            else request.deny();
        });
    }

    static boolean allowed(PermissionRequest request) {
        if (request == null || request.getOrigin() == null) return false;
        if (!"https".equals(request.getOrigin().getScheme()) || !"dominiksolorz.github.io".equals(request.getOrigin().getHost())) return false;
        String[] resources = request.getResources();
        if (resources == null || resources.length == 0) return false;
        for (String resource : resources) if (!PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) return false;
        return true;
    }

    void handle(PermissionRequest request) {
        if (!allowed(request)) { request.deny(); return; }
        if (activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
            return;
        }
        if (pending != null) pending.deny();
        pending = request;
        ask.launch(Manifest.permission.RECORD_AUDIO);
    }

    void cancel(PermissionRequest request) {
        if (pending == request) pending = null;
    }
}
