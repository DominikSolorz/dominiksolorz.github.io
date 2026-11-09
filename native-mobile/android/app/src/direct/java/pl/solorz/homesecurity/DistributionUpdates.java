package pl.solorz.homesecurity;

import android.app.Activity;
import android.view.View;

/** Only the direct-download build may fetch and install APK updates. */
final class DistributionUpdates {
    private final AppUpdater updater;
    DistributionUpdates(Activity activity) { updater = new AppUpdater(activity); }
    void bind(View button) { button.setOnClickListener(v -> updater.check(true)); }
    void resume() { updater.resume(); }
    void pause() { updater.pause(); }
    void close() { updater.close(); }
}
