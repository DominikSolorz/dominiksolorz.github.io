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
    private ActivityScenario<MainActivity> launch(boolean fixture) {
        return ActivityScenario.launch(new Intent(context,MainActivity.class).putExtra("hsEmulatorFixture",fixture));
    }
    private UiObject2 control(String id) {
        UiObject2 object=device.wait(Until.findObject(By.res(context.getPackageName(),id)),10000);
        assertNotNull("Missing visible control: "+id,object); return object;
    }
    private void waitFor(Callable<Boolean> condition,long timeout) throws Exception {
        long end=SystemClock.uptimeMillis()+timeout;
        while(SystemClock.uptimeMillis()<end) { if(condition.call())return; SystemClock.sleep(100); }
        fail("Condition did not become true within "+timeout+" ms");
    }
    private boolean visible(ActivityScenario<MainActivity> scenario,int id) {
        AtomicBoolean shown=new AtomicBoolean();scenario.onActivity(a->shown.set(a.findViewById(id).isShown()));return shown.get();
    }
    private String js(ActivityScenario<MainActivity> scenario,String script) throws Exception {
        AtomicReference<String> result=new AtomicReference<>();scenario.onActivity(a->((WebView)a.findViewById(R.id.ownerWeb)).evaluateJavascript(script,result::set));
        waitFor(()->result.get()!=null,10000);return result.get();
    }
    private void capture(ActivityScenario<MainActivity> scenario,String name) throws Exception {
        // Only these synthetic/fresh-login emulator tests may capture the screen.
        // Release privacy flags and all real account sessions remain protected.
        scenario.onActivity(a->{assertTrue((a.getWindow().getAttributes().flags & WindowManager.LayoutParams.FLAG_SECURE)!=0);a.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);});
        try {
            device.waitForIdle(2000);
            File directory=new File(context.getExternalFilesDir(null),"emulator-proof");assertTrue(directory.isDirectory()||directory.mkdirs());
            assertTrue("Could not save screenshot",device.takeScreenshot(new File(directory,name+".png")));
        } finally { scenario.onActivity(a->a.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE)); }
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
            control("navRecordings").click();waitFor(()->visible(scenario,R.id.ownerWeb)&&!visible(scenario,R.id.panelLoading),20000);
            assertEquals("true",js(scenario,"location.href.includes('mobileView=recordings')"));
            control("navAccount").click();waitFor(()->!visible(scenario,R.id.panelLoading),20000);
            assertEquals("true",js(scenario,"location.href.includes('mobileView=settings')"));
            device.pressBack();waitFor(()->visible(scenario,R.id.homeScreen),10000);
        }
    }
    @Test public void b_syntheticWebRtcVideoAndResponsivePanel() throws Exception {
        try(ActivityScenario<MainActivity> scenario=launch(true)) {
            control("navLive").click();waitFor(()->!visible(scenario,R.id.panelLoading),20000);
            UiObject2 start=device.wait(Until.findObject(By.text("Uruchom test mediów")),15000);assertNotNull("Web media test button",start);start.click();
            waitFor(()->"true".equals(js(scenario,"Boolean(window.testMedia&&window.testMedia.ready&&document.getElementById('testRemote').videoWidth>0)")),30000);
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
                scenario.onActivity(a->assertTrue((a.getWindow().getAttributes().flags&WindowManager.LayoutParams.FLAG_SECURE)!=0));
            }
        } finally { device.setOrientationNatural();device.unfreezeRotation();device.executeShellCommand("wm size reset");device.executeShellCommand("wm density reset");device.executeShellCommand("settings put system font_scale 1.0"); }
    }
    @Test public void d_offlineErrorAndRetry() throws Exception {
        try {
            device.executeShellCommand("svc wifi disable");device.executeShellCommand("svc data disable");
            try(ActivityScenario<MainActivity> scenario=launch(false)) {
                control("navLive").click();waitFor(()->visible(scenario,R.id.errorScreen),30000);capture(scenario,"05-offline-error");
                control("retryPanel").click();waitFor(()->visible(scenario,R.id.errorScreen),30000);
                control("errorGoHome").click();waitFor(()->visible(scenario,R.id.homeScreen),10000);
            }
        } finally { device.executeShellCommand("svc wifi enable");device.executeShellCommand("svc data enable"); }
    }
    @Test public void e_publicLoginLoadsInPhoneViewport() throws Exception {
        try(ActivityScenario<MainActivity> scenario=launch(false)) {
            control("navLive").click();waitFor(()->!visible(scenario,R.id.panelLoading),45000);
            assertFalse("Public login failed to load",visible(scenario,R.id.errorScreen));
            assertEquals("true",js(scenario,"location.host==='dominiksolorz.github.io'&&innerWidth<600"));
            assertEquals("true",js(scenario,"document.documentElement.scrollWidth<=innerWidth+1"));capture(scenario,"06-real-public-login");
        }
    }
}
