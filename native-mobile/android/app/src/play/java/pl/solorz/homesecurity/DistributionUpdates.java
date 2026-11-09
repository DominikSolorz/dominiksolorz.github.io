package pl.solorz.homesecurity;

import android.app.Activity;
import android.view.View;

/** Google Play owns updates. No APK downloader, scheduler or installer is shipped. */
final class DistributionUpdates {
    DistributionUpdates(Activity activity) {}
    void bind(View button) { button.setVisibility(View.GONE); }
    void resume() {}
    void pause() {}
    void close() {}
}
