package pl.solorz.homesecurity;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.TextView;
import java.io.IOException;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

public final class MainActivity extends ComponentActivity {
    private WebView web;
    private int fittedHomeWidth=-1;
    private AppUpdater updater;
    private final MicrophoneAccess microphone = new MicrophoneAccess(this);
    private TextView status;
    private View home, error, loading, bottom;
    private boolean showingHome = true, pageFailed = false, background = false;
    private String currentRoute = "home";
    private boolean engineUpdateRequired=false;
    public static boolean supportsCurrentWebView() {
        android.content.pm.PackageInfo provider=WebView.getCurrentWebViewPackage();
        try { return provider!=null && Integer.parseInt(provider.versionName.split("[.]")[0])>=124; }
        catch(RuntimeException invalidVersion) { return false; }
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        getWindow().setDecorFitsSystemWindows(false);
        setContentView(R.layout.activity_main);
        ((TextView)findViewById(R.id.versionNote)).setText(getString(R.string.preview_note,BuildConfig.VERSION_NAME));
        findViewById(R.id.nativeRoot).addOnLayoutChangeListener((v,l,t,r,b,ol,ot,or,ob)->fitHomeContent());
        updater=new AppUpdater(this);
        findViewById(R.id.checkAppUpdate).setOnClickListener(v->updater.check(true));
        web = findViewById(R.id.ownerWeb); status = findViewById(R.id.nativeStatus);
        home = findViewById(R.id.homeScreen); error = findViewById(R.id.errorScreen);
        loading = findViewById(R.id.panelLoading); bottom = findViewById(R.id.nativeBottomNav);
        findViewById(R.id.nativeRoot).setOnApplyWindowInsetsListener((v,insets)->{
            android.graphics.Insets bars = insets.getInsets(android.view.WindowInsets.Type.systemBars() | android.view.WindowInsets.Type.ime());
            v.setPadding(bars.left,bars.top,bars.right,bars.bottom);
            bottom.setVisibility(insets.isVisible(android.view.WindowInsets.Type.ime()) ? View.GONE : View.VISIBLE);
            return insets;
        });
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setUseWideViewPort(true); settings.setLoadWithOverviewMode(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        // Opening the camera panel is explicit; allow its video track to start when connected.
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUserAgentString(settings.getUserAgentString()+" HomeSecurityNative/"+BuildConfig.VERSION_NAME+" Android");
        web.setBackgroundColor(Color.rgb(9,13,22));
        CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if(!request.isForMainFrame()) return false;
                if(NavigationPolicy.isPanel(url)) return false;
                if(request.getUrl().getPath()!=null && request.getUrl().getPath().contains("/auth/")) {
                    new AlertDialog.Builder(MainActivity.this).setTitle(R.string.login_title)
                        .setMessage(R.string.login_notice).setPositiveButton(R.string.understood,null).show(); return true;
                }
                if(request.hasGesture() && NavigationPolicy.isExternalHttps(url)) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url))); }
                    catch(android.content.ActivityNotFoundException ignored) { status.setText(R.string.no_browser); }
                }
                return true;
            }
            @Override public void onPageFinished(WebView view,String url) {
                loading.setVisibility(View.GONE);
                if(!pageFailed) status.setText(R.string.panel_access);
                if(NavigationPolicy.isPanel(url)) {
                    applyPhoneRoute();
                    // Remove duplicate web navigation; account and PIN gates are untouched.
                    web.evaluateJavascript("(()=>{if(document.getElementById('hs-native-chrome'))return;const s=document.createElement('style');s.id='hs-native-chrome';s.textContent='.mobileBottomNav,.mobileAppHeader{display:none!important}body.mobileOwnerMode{padding-bottom:0!important}';document.head.append(s)})()",null);
                }
            }
            @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError failure) { if(request.isForMainFrame()) showError(); }
            @Override public void onReceivedHttpError(WebView view,WebResourceRequest request,WebResourceResponse response) { if(request.isForMainFrame() && response.getStatusCode()>=400) showError(); }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) { microphone.handle(request); }
            @Override public void onPermissionRequestCanceled(PermissionRequest request) { microphone.cancel(request); }
        });
        findViewById(R.id.openLive).setOnClickListener(v->openPanel("home",false));
        findViewById(R.id.openRecordings).setOnClickListener(v->openPanel("recordings",false));
        findViewById(R.id.openSettings).setOnClickListener(v->openPanel("settings",false));
        findViewById(R.id.navHome).setOnClickListener(v->showHome());
        findViewById(R.id.navLive).setOnClickListener(v->openPanel("home",false));
        findViewById(R.id.navRecordings).setOnClickListener(v->openPanel("recordings",false));
        findViewById(R.id.navAccount).setOnClickListener(v->openPanel("settings",false));
        findViewById(R.id.refreshPanel).setOnClickListener(v->{ if(showingHome) openPanel("home",false); else openPanel(currentRoute,true); });
        findViewById(R.id.retryPanel).setOnClickListener(v->{ if(engineUpdateRequired) openEngineUpdate(); else openPanel(currentRoute,true); });
        findViewById(R.id.errorGoHome).setOnClickListener(v->showHome());
        getOnBackPressedDispatcher().addCallback(this,new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() { if(!showingHome) showHome(); else finish(); }
        });
        if(state!=null && !state.getBoolean("native.home",true)) {
            currentRoute=state.getString("native.route","home");
            if(web.restoreState(state)!=null) showPanel(); else openPanel(currentRoute,true);
        } else showHome();
    }
    private int dp(float value) { return Math.round(value*getResources().getDisplayMetrics().density); }
    private void fitHomeContent() {
        int available=findViewById(R.id.homeScreen).getWidth();
        int width=Math.min(available,dp(680));
        if(width<=0 || width==fittedHomeWidth)return;
        fittedHomeWidth=width;
        View content=findViewById(R.id.homeContent);
        android.widget.FrameLayout.LayoutParams cp=(android.widget.FrameLayout.LayoutParams)content.getLayoutParams();
        cp.width=width;cp.gravity=android.view.Gravity.CENTER_HORIZONTAL;content.setLayoutParams(cp);
        for(int id:new int[]{R.id.nativeHeader,R.id.nativeBottomNav}) {
            View v=findViewById(id);
            android.widget.LinearLayout.LayoutParams p=(android.widget.LinearLayout.LayoutParams)v.getLayoutParams();
            p.width=width;p.gravity=android.view.Gravity.CENTER_HORIZONTAL;v.setLayoutParams(p);
        }
        boolean wide=width>=dp(600);
        android.widget.LinearLayout cards=findViewById(R.id.homeCards),quick=findViewById(R.id.quickActions);
        cards.setOrientation(wide?android.widget.LinearLayout.HORIZONTAL:android.widget.LinearLayout.VERTICAL);
        quick.setOrientation(wide?android.widget.LinearLayout.VERTICAL:android.widget.LinearLayout.HORIZONTAL);
        View live=findViewById(R.id.liveCard);
        android.widget.LinearLayout.LayoutParams lp=new android.widget.LinearLayout.LayoutParams(wide?0:-1,-2,wide?1.25f:0);
        lp.setMarginEnd(wide?dp(14):0);live.setLayoutParams(lp);
        android.widget.LinearLayout.LayoutParams qp=new android.widget.LinearLayout.LayoutParams(wide?0:-1,-2,wide?1f:0);
        qp.topMargin=wide?0:dp(16);quick.setLayoutParams(qp);
        for(int id:new int[]{R.id.openRecordings,R.id.openSettings}) {
            View v=findViewById(id);
            android.widget.LinearLayout.LayoutParams p=new android.widget.LinearLayout.LayoutParams(wide?-1:0,-2,wide?0:1);
            v.setLayoutParams(p);v.setMinimumHeight(dp(wide?104:136));
        }
        View gap=quick.getChildAt(1);
        gap.setLayoutParams(new android.widget.LinearLayout.LayoutParams(wide?1:dp(12),wide?dp(12):1));
    }
    private void showHome() {
        web.onPause();
        web.evaluateJavascript("document.querySelectorAll('video,audio').forEach(el=>el.pause())",null);
        showingHome=true; home.setVisibility(View.VISIBLE); web.setVisibility(View.GONE);
        error.setVisibility(View.GONE); loading.setVisibility(View.GONE);
        status.setText(R.string.private_access); selectTab(R.id.navHome);
    }
    private void showPanel() {
        web.onResume();
        showingHome=false; home.setVisibility(View.GONE); error.setVisibility(View.GONE); web.setVisibility(View.VISIBLE);
        selectTab(currentRoute.equals("recordings")?R.id.navRecordings:currentRoute.equals("settings")?R.id.navAccount:R.id.navLive);
    }
    private void openPanel(String route,boolean refresh) {
        boolean reuse=web.getUrl()!=null && !pageFailed && !refresh;
        NavigationPolicy.view(route); currentRoute=route; showPanel();
        if(!supportsCurrentWebView()) { showEngineUpdate(); return; }
        engineUpdateRequired=false;
        if(reuse) { applyPhoneRoute(); return; }
        pageFailed=false; status.setText(R.string.loading); loading.setVisibility(View.VISIBLE);
        if(BuildConfig.DEBUG && getIntent().getBooleanExtra("hsEmulatorFixture",false)) {
            try {
                String html;
                try(InputStream stream=getAssets().open("emulator-panel.html"); ByteArrayOutputStream bytes=new ByteArrayOutputStream()) {
                    byte[] buffer=new byte[4096]; int count; while((count=stream.read(buffer))!=-1) bytes.write(buffer,0,count);
                    html=new String(bytes.toByteArray(),StandardCharsets.UTF_8);
                }
                web.loadDataWithBaseURL(NavigationPolicy.view(route),html,"text/html","UTF-8",null);
            } catch(IOException failed) { showError(); }
        } else web.loadUrl(NavigationPolicy.view(route));
    }
    private void applyPhoneRoute() {
        String route=org.json.JSONObject.quote(currentRoute);
        web.evaluateJavascript("(()=>{const route="+route+";window.__hsNativeRouteObserver?.disconnect();const select=()=>{const b=document.querySelector('button[data-mobile-view=\"'+route+'\"]');if(!b)return false;b.click();document.querySelectorAll('video').forEach(v=>{if(!v.srcObject)return;if(route==='home')v.play().catch(()=>{});else v.pause()});return true;};if(!select()){const observer=new MutationObserver(()=>{if(select())observer.disconnect()});window.__hsNativeRouteObserver=observer;observer.observe(document.body,{childList:true,subtree:true});}})()",null);
    }
    private void showEngineUpdate() {
        engineUpdateRequired=true; pageFailed=true; loading.setVisibility(View.GONE);web.setVisibility(View.GONE);error.setVisibility(View.VISIBLE);
        ((TextView)findViewById(R.id.errorTitle)).setText(R.string.engine_update_title);
        ((TextView)findViewById(R.id.errorDescription)).setText(R.string.engine_update_description);
        ((TextView)findViewById(R.id.retryPanel)).setText(R.string.engine_update_action);
        status.setText(R.string.engine_update_title);
    }
    private void openEngineUpdate() {
        android.content.pm.PackageInfo provider=WebView.getCurrentWebViewPackage();
        String pkg=provider!=null?provider.packageName:"com.google.android.webview";
        try { startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("https://play.google.com/store/apps/details?id="+Uri.encode(pkg)))); }
        catch(android.content.ActivityNotFoundException ignored) { status.setText(R.string.no_browser); }
    }
    private void showError() {
        engineUpdateRequired=false;
        ((TextView)findViewById(R.id.errorTitle)).setText(R.string.connection_error_title);
        ((TextView)findViewById(R.id.errorDescription)).setText(R.string.connection_error_description);
        ((TextView)findViewById(R.id.retryPanel)).setText(R.string.retry);
        pageFailed=true; loading.setVisibility(View.GONE);
        if(!showingHome) { web.setVisibility(View.GONE); error.setVisibility(View.VISIBLE); status.setText(R.string.connection_error_title); }
    }
    private void selectTab(int selected) {
        for(int id:new int[]{R.id.navHome,R.id.navLive,R.id.navRecordings,R.id.navAccount}) {
            TextView tab=findViewById(id); boolean active=id==selected;
            tab.setSelected(active); tab.setBackgroundResource(active?R.drawable.nav_active:0);
            int tint=Color.parseColor(active?"#51EAE2":"#B6CDD8");
            tab.setTextColor(tint); tab.setCompoundDrawableTintList(android.content.res.ColorStateList.valueOf(tint));
        }
    }
    @Override protected void onSaveInstanceState(Bundle state) { state.putBoolean("native.home",showingHome); state.putString("native.route",currentRoute); web.saveState(state); super.onSaveInstanceState(state); }
    @Override protected void onPause() { if(updater!=null)updater.pause(); if(!showingHome) web.setVisibility(View.INVISIBLE); web.onPause(); background=true; super.onPause(); }
    @Override protected void onResume() { super.onResume(); if(updater!=null)updater.resume(); if(web!=null) { web.onResume(); if(!showingHome && !pageFailed) web.setVisibility(View.VISIBLE); if(background && !showingHome) status.setText(R.string.returned); background=false; } }
    @Override protected void onDestroy() { if(updater!=null)updater.close(); web.destroy(); super.onDestroy(); }
}
