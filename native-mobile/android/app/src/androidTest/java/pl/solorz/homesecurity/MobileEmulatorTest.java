package pl.solorz.homesecurity;

import android.content.Context;
import android.content.Intent;
import android.graphics.Rect;
import android.os.SystemClock;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.By;
import androidx.test.uiautomator.UiDevice;
import androidx.test.uiautomator.UiObject2;
import androidx.test.uiautomator.Until;
import org.junit.Test;
import org.junit.Before;
import org.junit.After;
import androidx.test.runner.lifecycle.ActivityLifecycleCallback;
import androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry;
import androidx.test.runner.lifecycle.Stage;
import org.junit.FixMethodOrder;
import org.junit.runners.MethodSorters;
import org.junit.runner.RunWith;
import java.io.File;
import java.util.concurrent.Callable;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
@FixMethodOrder(MethodSorters.NAME_ASCENDING)
public class MobileEmulatorTest {
    private final Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
    private final UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
    private final AtomicBoolean privacyGuardObserved=new AtomicBoolean();
    private ActivityLifecycleCallback screenshotLifecycle;
    @Before public void observePrivacyBeforeCapturingFreshTestScreens() {
        // Instrumentation only; no screenshot override is shipped inside the app APK.
        screenshotLifecycle=(activity,stage)->{
            if(activity instanceof MainActivity && stage==Stage.CREATED) {
                assertTrue("App must protect real sessions",(activity.getWindow().getAttributes().flags&WindowManager.LayoutParams.FLAG_SECURE)!=0);
                privacyGuardObserved.set(true);
                activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            }
        };
        InstrumentationRegistry.getInstrumentation().runOnMainSync(()->ActivityLifecycleMonitorRegistry.getInstance().addLifecycleCallback(screenshotLifecycle));
    }
    @After public void removeScreenshotInstrumentation() {
        InstrumentationRegistry.getInstrumentation().runOnMainSync(()->ActivityLifecycleMonitorRegistry.getInstance().removeLifecycleCallback(screenshotLifecycle));
    }
    private File proofDirectory() {
        File directory=new File(context.getFilesDir(),"emulator-proof");directory.mkdirs();return directory;
    }
    private ActivityScenario<MainActivity> launch(boolean fixture) {
        return ActivityScenario.launch(new Intent(context,MainActivity.class).putExtra("hsEmulatorFixture",fixture));
    }
    private UiObject2 control(String id) {
        UiObject2 object=device.wait(Until.findObject(By.res(context.getPackageName(),id)),5000);
        if(object==null && device.hasObject(By.text("Pixel Launcher isn't responding"))) {
            // An observed emulator launcher ANR, never an ANR from our app.
            UiObject2 close=device.findObject(By.res("android","aerr_close"));
            if(close!=null) { System.out.println("EMULATOR_LAUNCHER_ANR_CLOSED");close.click(); }
            object=device.wait(Until.findObject(By.res(context.getPackageName(),id)),10000);
        }
        if(object==null) {
            try { device.dumpWindowHierarchy(new File(proofDirectory(),"missing-"+id+".xml"));device.takeScreenshot(new File(proofDirectory(),"missing-"+id+".png")); }
            catch(Exception ignored) {}
            System.out.println("ACTIVE_PACKAGE="+device.getCurrentPackageName());
        }
        assertNotNull("Missing visible control: "+id,object); return object;
    }
    private void waitFor(Callable<Boolean> condition,long timeout) throws Exception {
        long end=SystemClock.uptimeMillis()+timeout;
        while(SystemClock.uptimeMillis()<end) { if(condition.call())return; SystemClock.sleep(100); }
        fail("Condition did not become true within "+timeout+" ms");
    }
    private void waitForNetwork() throws Exception {
        android.net.ConnectivityManager manager=(android.net.ConnectivityManager)context.getSystemService(Context.CONNECTIVITY_SERVICE);
        waitFor(()->{
            android.net.Network network=manager.getActiveNetwork();
            android.net.NetworkCapabilities capabilities=manager.getNetworkCapabilities(network);
            return capabilities!=null && capabilities.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET)
                && capabilities.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_VALIDATED);
        },30000);
    }
    private boolean supportedEngine() { return MainActivity.supportsCurrentWebView(); }
    private void assertUpdateScreen(ActivityScenario<MainActivity> scenario) throws Exception {
        waitFor(()->visible(scenario,R.id.errorScreen),10000);
        scenario.onActivity(a->assertEquals(a.getString(R.string.engine_update_title),((android.widget.TextView)a.findViewById(R.id.errorTitle)).getText().toString()));
        capture(scenario,"07-outdated-system-component");
    }
    private boolean visible(ActivityScenario<MainActivity> scenario,int id) {
        AtomicBoolean shown=new AtomicBoolean();scenario.onActivity(a->shown.set(a.findViewById(id).isShown()));return shown.get();
    }
    private String js(ActivityScenario<MainActivity> scenario,String script) throws Exception {
        AtomicReference<String> result=new AtomicReference<>();scenario.onActivity(a->((WebView)a.findViewById(R.id.ownerWeb)).evaluateJavascript(script,result::set));
        waitFor(()->result.get()!=null,10000);return result.get();
    }
    private void capture(ActivityScenario<MainActivity> scenario,String name) throws Exception {
        assertTrue("Privacy guard must be verified before test capture",privacyGuardObserved.get());
        device.waitForIdle(2000);
        File out=new File(proofDirectory(),name+".png");
        if(!device.takeScreenshot(out)) { SystemClock.sleep(500); assertTrue("Could not save screenshot",device.takeScreenshot(out)); }
    }
    @Test public void a_nativePhoneHomeAndNavigation() throws Exception {
        try(ActivityScenario<MainActivity> scenario=launch(true)) {
            assertTrue(visible(scenario,R.id.homeScreen));assertFalse(visible(scenario,R.id.ownerWeb));
            scenario.onActivity(a->{
                float density=a.getResources().getDisplayMetrics().density;
                assertTrue("Use phone-sized emulator",a.findViewById(R.id.nativeRoot).getWidth()/density<600);
                for(int id:new int[]{R.id.navHome,R.id.navLive,R.id.navRecordings,R.id.navAccount}) {
                    View v=a.findViewById(id);assertTrue("Touch target height",v.getHeight()/density>=48);assertTrue("Touch target width",v.getWidth()/density>=48);
                }
                WebView w=a.findViewById(R.id.ownerWeb);
                assertFalse(w.getSettings().getAllowFileAccess());assertFalse(w.getSettings().getAllowContentAccess());
                assertEquals(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW,w.getSettings().getMixedContentMode());
            });
            capture(scenario,"01-native-home");
            if(!supportedEngine()) { control("navRecordings").click();assertUpdateScreen(scenario);control("errorGoHome").click();return; }
            control("navRecordings").click();waitFor(()->visible(scenario,R.id.ownerWeb)&&!visible(scenario,R.id.panelLoading),20000);
            waitFor(()->"true".equals(js(scenario,"document.body.dataset.mobileView==='recordings'")),20000);
            control("navAccount").click();waitFor(()->!visible(scenario,R.id.panelLoading),20000);
            waitFor(()->"true".equals(js(scenario,"document.body.dataset.mobileView==='settings'")),20000);
            device.pressBack();waitFor(()->visible(scenario,R.id.homeScreen),10000);
        }
    }
    @Test public void b_syntheticWebRtcVideoAndResponsivePanel() throws Exception {
        try(ActivityScenario<MainActivity> scenario=launch(true)) {
            control("navLive").click();
            if(!supportedEngine()) { assertUpdateScreen(scenario); return; }
            waitFor(()->!visible(scenario,R.id.panelLoading),20000);
            UiObject2 start=device.wait(Until.findObject(By.text("Uruchom test mediów")),15000);assertNotNull("Web media test button",start);start.click();
            try { waitFor(()->"true".equals(js(scenario,"Boolean(window.testMedia&&window.testMedia.ready&&window.testMedia.decoded>5&&document.getElementById('testRemote').videoWidth>0)")),30000); }
            finally { System.out.println("MEDIA_DIAGNOSTICS="+js(scenario,"JSON.stringify({test:window.testMedia,time:document.getElementById('testRemote').currentTime,width:document.getElementById('testRemote').videoWidth})")); capture(scenario,"02-media-diagnostics"); }
            assertEquals("true",js(scenario,"document.documentElement.scrollWidth<=innerWidth+1"));
            assertEquals("true",js(scenario,"innerWidth<600"));capture(scenario,"02-webrtc-test-video");
        }
    }
    @Test public void c_smallScreenLargeTextAndLandscape() throws Exception {
        try {
            device.executeShellCommand("wm size 720x1280");device.executeShellCommand("wm density 320");device.executeShellCommand("settings put system font_scale 1.3");
            try(ActivityScenario<MainActivity> scenario=launch(true)) {
                control("navHome");capture(scenario,"03-small-phone-large-text");
                scenario.onActivity(a->{Rect rect=new Rect();for(int id:new int[]{R.id.navHome,R.id.navLive,R.id.navRecordings,R.id.navAccount})assertTrue(a.findViewById(id).getGlobalVisibleRect(rect));});
                device.setOrientationLeft();device.waitForIdle(2000);control("navLive").click();waitFor(()->!visible(scenario,R.id.panelLoading),20000);
                capture(scenario,"04-landscape-panel");
                scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED);scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED);
                assertTrue(privacyGuardObserved.get());
            }
        } finally { device.setOrientationNatural();device.unfreezeRotation();device.executeShellCommand("wm size reset");device.executeShellCommand("wm density reset");device.executeShellCommand("settings put system font_scale 1.0"); }
    }
    @Test public void d_offlineErrorAndRetry() throws Exception {
        try {
            device.executeShellCommand("svc wifi disable");device.executeShellCommand("svc data disable");
            try(ActivityScenario<MainActivity> scenario=launch(false)) {
                control("navLive").click();waitFor(()->visible(scenario,R.id.errorScreen),30000);capture(scenario,"05-offline-error");
                if(supportedEngine()) { control("retryPanel").click();waitFor(()->visible(scenario,R.id.errorScreen),30000); } else assertUpdateScreen(scenario);
                control("errorGoHome").click();waitFor(()->visible(scenario,R.id.homeScreen),10000);
            }
        } finally { device.executeShellCommand("svc wifi enable");device.executeShellCommand("svc data enable"); if(supportedEngine())waitForNetwork(); }
    }
    @Test public void e_publicLoginLoadsInPhoneViewport() throws Exception {
        if(supportedEngine())waitForNetwork();
        try(ActivityScenario<MainActivity> scenario=launch(false)) {
            control("navLive").click();
            if(!supportedEngine()) { assertUpdateScreen(scenario); return; }
            waitFor(()->!visible(scenario,R.id.panelLoading),45000);
            if(visible(scenario,R.id.errorScreen)) {
                capture(scenario,"06-login-first-load-error");
                control("retryPanel").click();waitFor(()->!visible(scenario,R.id.panelLoading),45000);
            }
            assertFalse("Public login failed to load after restoring network and one native retry",visible(scenario,R.id.errorScreen));
            assertEquals("true",js(scenario,"location.host==='dominiksolorz.github.io'&&innerWidth<600"));
            waitFor(()->"true".equals(js(scenario,"Boolean(document.getElementById('authDialog')&&!document.getElementById('authDialog').hidden&&!document.getElementById('loginForm').hidden)")),30000);
            assertEquals("true",js(scenario,"document.documentElement.scrollWidth<=innerWidth+1"));capture(scenario,"06-real-public-login");
        }
    }
    @Test public void f_tabletLayoutVersionAndHeaderAction() throws Exception {
        try {
            device.executeShellCommand("wm size 1600x2560");
            device.executeShellCommand("wm density 240");
            device.executeShellCommand("settings put system font_scale 1.3");
            try(ActivityScenario<MainActivity> scenario=launch(true)) {
                waitFor(()->visible(scenario,R.id.homeScreen),10000);
                scenario.onActivity(a->{
                    float density=a.getResources().getDisplayMetrics().density;
                    View content=a.findViewById(R.id.homeContent);
                    assertTrue("Tablet content is bounded",content.getWidth()/density<=681);
                    assertTrue("Tablet content is wide enough",content.getWidth()/density>=600);
                    assertEquals(android.widget.LinearLayout.HORIZONTAL,((android.widget.LinearLayout)a.findViewById(R.id.homeCards)).getOrientation());
                    assertEquals(a.getString(R.string.preview_note,BuildConfig.VERSION_NAME),((android.widget.TextView)a.findViewById(R.id.versionNote)).getText().toString());
                    Rect root=new Rect();a.findViewById(R.id.nativeRoot).getGlobalVisibleRect(root);
                    for(int id:new int[]{R.id.navHome,R.id.navLive,R.id.navRecordings,R.id.navAccount}) {
                        Rect rect=new Rect();assertTrue(a.findViewById(id).getGlobalVisibleRect(rect));
                        assertTrue("Navigation stays on screen",root.contains(rect));
                    }
                });
                capture(scenario,"08-tablet-cyan-interface");
                control("refreshPanel").click();
                if(supportedEngine())waitFor(()->visible(scenario,R.id.ownerWeb),10000);
                else assertUpdateScreen(scenario);
                assertFalse("Header action opens the panel from home",visible(scenario,R.id.homeScreen));
            }
        } finally {
            device.executeShellCommand("wm size reset");
            device.executeShellCommand("wm density reset");
            device.executeShellCommand("settings put system font_scale 1.0");
        }
    }
    @Test public void g_distributionUpdateBoundary() throws Exception {
        boolean play = "play".equals(BuildConfig.FLAVOR);
        android.content.pm.PackageInfo info = context.getPackageManager().getPackageInfo(
            context.getPackageName(), android.content.pm.PackageManager.GET_PERMISSIONS
                | android.content.pm.PackageManager.GET_PROVIDERS);
        boolean installerPermission = info.requestedPermissions != null && java.util.Arrays.asList(
            info.requestedPermissions).contains("android.permission.REQUEST_INSTALL_PACKAGES");
        assertEquals("Only direct APK may request an installer", !play, installerPermission);
        boolean updateProvider = false;
        if (info.providers != null) for (android.content.pm.ProviderInfo provider : info.providers)
            if ((context.getPackageName()+".updates").equals(provider.authority)) updateProvider = true;
        assertEquals("Only direct APK contains the update file provider", !play, updateProvider);
        if (play) {
            try { Class.forName("pl.solorz.homesecurity.AppUpdater"); fail("Play contains APK updater"); }
            catch (ClassNotFoundException expected) { /* Physically excluded from Play. */ }
        }
        try (ActivityScenario<MainActivity> scenario = launch(true)) {
            scenario.onActivity(a -> assertEquals(play ? View.GONE : View.VISIBLE,
                a.findViewById(R.id.checkAppUpdate).getVisibility()));
        }
    }
    @Test public void h_adaptiveIconAndServerError() throws Exception {
        assertTrue(context.getApplicationInfo().loadIcon(context.getPackageManager()) instanceof android.graphics.drawable.AdaptiveIconDrawable);
        android.graphics.drawable.AdaptiveIconDrawable icon = (android.graphics.drawable.AdaptiveIconDrawable)
            context.getApplicationInfo().loadIcon(context.getPackageManager());
        assertNotNull(icon.getBackground()); assertNotNull(icon.getForeground());
        if (android.os.Build.VERSION.SDK_INT >= 33) assertNotNull(icon.getMonochrome());
        try (ActivityScenario<MainActivity> scenario = launch(true)) {
            control("navLive").click();
            if (!supportedEngine()) { assertUpdateScreen(scenario); return; }
            waitFor(() -> !visible(scenario, R.id.panelLoading), 20000);
            scenario.onActivity(a -> {
                WebView web = a.findViewById(R.id.ownerWeb);
                android.webkit.WebResourceRequest request = new android.webkit.WebResourceRequest() {
                    public android.net.Uri getUrl() { return android.net.Uri.parse(NavigationPolicy.view("home")); }
                    public boolean isForMainFrame() { return true; }
                    public boolean isRedirect() { return false; }
                    public boolean hasGesture() { return true; }
                    public String getMethod() { return "GET"; }
                    public java.util.Map<String,String> getRequestHeaders() { return java.util.Collections.emptyMap(); }
                };
                web.getWebViewClient().onReceivedHttpError(web, request,
                    new android.webkit.WebResourceResponse("text/plain", "UTF-8", 503, "Unavailable",
                        java.util.Collections.emptyMap(), new java.io.ByteArrayInputStream(new byte[0])));
                assertEquals(a.getString(R.string.server_error_title), ((android.widget.TextView)a.findViewById(R.id.errorTitle)).getText().toString());
            });
            assertTrue(visible(scenario, R.id.errorScreen)); capture(scenario,"09-server-error");
            control("retryPanel").click(); waitFor(() -> !visible(scenario,R.id.panelLoading),20000);
            assertFalse(visible(scenario, R.id.errorScreen));
        }
    }
    @Test public void i_locationRequiresConsentAndTrustedActivePage() throws Exception {
        android.content.pm.PackageInfo info = context.getPackageManager().getPackageInfo(context.getPackageName(), android.content.pm.PackageManager.GET_PERMISSIONS);
        assertFalse(java.util.Arrays.asList(info.requestedPermissions).contains("android.permission.ACCESS_BACKGROUND_LOCATION"));
        try (ActivityScenario<MainActivity> scenario = launch(true)) {
            AtomicReference<Boolean> answer = new AtomicReference<>();
            scenario.onActivity(a -> ((WebView)a.findViewById(R.id.ownerWeb)).getWebChromeClient()
                .onGeolocationPermissionsShowPrompt(NavigationPolicy.ORIGIN, (origin,allow,retain) -> { assertFalse(retain); answer.set(allow); }));
            assertEquals(Boolean.FALSE, answer.get()); // Native home cannot request location.
            control("navLive").click();
            if (!supportedEngine()) { assertUpdateScreen(scenario); return; }
            waitFor(() -> !visible(scenario,R.id.panelLoading),20000);
            answer.set(null);
            scenario.onActivity(a -> ((WebView)a.findViewById(R.id.ownerWeb)).getWebChromeClient()
                .onGeolocationPermissionsShowPrompt("https://foreign.example", (origin,allow,retain) -> answer.set(allow)));
            assertEquals(Boolean.FALSE, answer.get());
            scenario.onActivity(a -> assertTrue("Fixture must expose the trusted panel URL", NavigationPolicy.isPanel(((WebView)a.findViewById(R.id.ownerWeb)).getUrl())));
            assertEquals(android.content.pm.PackageManager.PERMISSION_DENIED,
                context.checkSelfPermission(android.Manifest.permission.ACCESS_COARSE_LOCATION));
            answer.set(null);
            scenario.onActivity(a -> ((WebView)a.findViewById(R.id.ownerWeb)).getWebChromeClient()
                .onGeolocationPermissionsShowPrompt(NavigationPolicy.ORIGIN, (origin,allow,retain) -> { assertFalse(retain); answer.set(allow); }));
            UiObject2 deny = device.wait(Until.findObject(By.res(java.util.regex.Pattern.compile("(?:com\\.android|com\\.google\\.android)\\.permissioncontroller:id/permission_deny_button"))),10000);
            if (deny == null) {
                java.io.ByteArrayOutputStream hierarchy = new java.io.ByteArrayOutputStream();
                device.dumpWindowHierarchy(hierarchy);
                System.out.println("LOCATION_PERMISSION_UI="+hierarchy.toString("UTF-8"));
                System.out.println("LOCATION_PERMISSION_RESULT="+answer.get());
            }
            assertNotNull("Android must ask for location permission", deny);
            deny.click(); waitFor(() -> answer.get()!=null,10000);
            assertEquals(Boolean.FALSE, answer.get());
            // Only the disposable emulator test app receives approximate permission.
            device.executeShellCommand("pm grant "+context.getPackageName()+" android.permission.ACCESS_COARSE_LOCATION");
            assertEquals(android.content.pm.PackageManager.PERMISSION_DENIED,
                context.checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION));
            answer.set(null);
            scenario.onActivity(a -> ((WebView)a.findViewById(R.id.ownerWeb)).getWebChromeClient()
                .onGeolocationPermissionsShowPrompt(NavigationPolicy.ORIGIN, (origin,allow,retain) -> { assertFalse(retain); answer.set(allow); }));
            assertEquals("Approximate location is sufficient", Boolean.TRUE, answer.get());
            assertEquals("true",js(scenario,"(()=>{const d=document.createElement('dialog');d.className='mobileMapDialog';document.body.append(d);d.showModal();return d.open})()"));
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED);
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED);
            assertEquals("false",js(scenario,"document.querySelector('dialog.mobileMapDialog').open"));
        }
    }
}
