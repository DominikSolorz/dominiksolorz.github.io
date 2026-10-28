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
    private TextView status;
    private View home, error, loading, bottom;
    private boolean showingHome = true, pageFailed = false, background = false;
    private String currentRoute = "home";
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        setContentView(R.layout.activity_main);
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
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setUserAgentString(settings.getUserAgentString()+" HomeSecurityNative/0.2 Android");
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
                    // Remove duplicate web navigation; account and PIN gates are untouched.
                    web.evaluateJavascript("(()=>{if(document.getElementById('hs-native-chrome'))return;const s=document.createElement('style');s.id='hs-native-chrome';s.textContent='.mobileBottomNav,.mobileAppHeader{display:none!important}body.mobileOwnerMode{padding-bottom:0!important}';document.head.append(s)})()",null);
                }
            }
            @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError failure) { if(request.isForMainFrame()) showError(); }
            @Override public void onReceivedHttpError(WebView view,WebResourceRequest request,WebResourceResponse response) { if(request.isForMainFrame() && response.getStatusCode()>=400) showError(); }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) { request.deny(); }
        });
        findViewById(R.id.openLive).setOnClickListener(v->openPanel("home",false));
        findViewById(R.id.openRecordings).setOnClickListener(v->openPanel("recordings",false));
        findViewById(R.id.openSettings).setOnClickListener(v->openPanel("settings",false));
        findViewById(R.id.navHome).setOnClickListener(v->showHome());
        findViewById(R.id.navLive).setOnClickListener(v->openPanel("home",false));
        findViewById(R.id.navRecordings).setOnClickListener(v->openPanel("recordings",false));
        findViewById(R.id.navAccount).setOnClickListener(v->openPanel("settings",false));
        findViewById(R.id.refreshPanel).setOnClickListener(v->{ if(!showingHome) openPanel(currentRoute,true); });
        findViewById(R.id.retryPanel).setOnClickListener(v->openPanel(currentRoute,true));
        findViewById(R.id.errorGoHome).setOnClickListener(v->showHome());
        getOnBackPressedDispatcher().addCallback(this,new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() { if(!showingHome) showHome(); else finish(); }
        });
        if(state!=null && !state.getBoolean("native.home",true)) {
            currentRoute=state.getString("native.route","home");
            if(web.restoreState(state)!=null) showPanel(); else openPanel(currentRoute,true);
        } else showHome();
    }
    private void showHome() {
        showingHome=true; home.setVisibility(View.VISIBLE); web.setVisibility(View.GONE);
        error.setVisibility(View.GONE); loading.setVisibility(View.GONE);
        status.setText(R.string.private_access); selectTab(R.id.navHome);
    }
    private void showPanel() {
        showingHome=false; home.setVisibility(View.GONE); error.setVisibility(View.GONE); web.setVisibility(View.VISIBLE);
        selectTab(currentRoute.equals("recordings")?R.id.navRecordings:currentRoute.equals("settings")?R.id.navAccount:R.id.navLive);
    }
    private void openPanel(String route,boolean refresh) {
        boolean reuse=route.equals(currentRoute) && web.getUrl()!=null && !pageFailed && !refresh;
        NavigationPolicy.view(route); currentRoute=route; showPanel();
        if(reuse) return;
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
    private void showError() {
        pageFailed=true; loading.setVisibility(View.GONE);
        if(!showingHome) { web.setVisibility(View.GONE); error.setVisibility(View.VISIBLE); status.setText(R.string.connection_error_title); }
    }
    private void selectTab(int selected) {
        for(int id:new int[]{R.id.navHome,R.id.navLive,R.id.navRecordings,R.id.navAccount}) {
            TextView tab=findViewById(id); boolean active=id==selected;
            tab.setSelected(active); tab.setBackgroundResource(active?R.drawable.nav_active:0);
            tab.setTextColor(Color.parseColor(active?"#FF8AA4":"#C4CAD5"));
        }
    }
    @Override protected void onSaveInstanceState(Bundle state) { state.putBoolean("native.home",showingHome); state.putString("native.route",currentRoute); web.saveState(state); super.onSaveInstanceState(state); }
    @Override protected void onPause() { if(!showingHome) web.setVisibility(View.INVISIBLE); web.onPause(); background=true; super.onPause(); }
    @Override protected void onResume() { super.onResume(); if(web!=null) { web.onResume(); if(!showingHome && !pageFailed) web.setVisibility(View.VISIBLE); if(background && !showingHome) status.setText(R.string.returned); background=false; } }
    @Override protected void onDestroy() { web.destroy(); super.onDestroy(); }
}
