package pl.solorz.homesecurity;

import android.app.Activity;
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
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public final class MainActivity extends Activity {
    private WebView web;
    private TextView status;
    private boolean background = false;
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setBackgroundColor(Color.rgb(9,11,17));
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            android.graphics.Insets bars = insets.getInsets(android.view.WindowInsets.Type.systemBars() | android.view.WindowInsets.Type.ime());
            v.setPadding(bars.left,bars.top,bars.right,bars.bottom); return insets;
        });
        status = new TextView(this); status.setTextColor(Color.WHITE); status.setPadding(20,12,20,12); status.setText("HOME SECURITY · wersja testowa");
        root.addView(status);
        web = new WebView(this); web.setBackgroundColor(Color.rgb(9,11,17));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setUserAgentString(settings.getUserAgentString()+" HomeSecurityNative/0.1 Android");
        CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (!request.isForMainFrame()) return false;
                if (NavigationPolicy.isPanel(url)) return false;
                // Do not open an OAuth redirect without returning a session to this app.
                if (request.getUrl().getPath()!=null && request.getUrl().getPath().contains("/auth/")) {
                    new AlertDialog.Builder(MainActivity.this).setTitle("Logowanie w aplikacji")
                        .setMessage("W tej wersji testowej użyj e-maila i hasła. Logowanie Google wymaga osobnego, bezpiecznego powrotu sesji do aplikacji.")
                        .setPositiveButton("Rozumiem",null).show(); return true;
                }
                if (request.hasGesture() && NavigationPolicy.isExternalHttps(url)) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url))); }
                    catch (android.content.ActivityNotFoundException ignored) { status.setText("Brak przeglądarki do otwarcia odnośnika."); }
                }
                return true;
            }
            @Override public void onPageFinished(WebView view,String url) { status.setText("HOME SECURITY · Preview 0.1 · konto i PIN w panelu"); }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if(request.isForMainFrame()) status.setText("Brak połączenia. Sprawdź internet i wybierz Odśwież.");
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) { request.deny(); }
        });
        root.addView(web,new LinearLayout.LayoutParams(-1,0,1));
        LinearLayout nav = new LinearLayout(this);
        addButton(nav,"Podgląd",()->web.loadUrl(NavigationPolicy.view("home")));
        addButton(nav,"Nagrania",()->web.loadUrl(NavigationPolicy.view("recordings")));
        addButton(nav,"Ustawienia",()->web.loadUrl(NavigationPolicy.view("settings")));
        addButton(nav,"Odśwież",()->web.reload()); root.addView(nav); setContentView(root);
        if (state==null || web.restoreState(state)==null) web.loadUrl(NavigationPolicy.view("home"));
    }
    private void addButton(LinearLayout nav,String title,Runnable action) {
        Button button = new Button(this); button.setText(title); button.setAllCaps(false); button.setTextSize(11);
        button.setOnClickListener(v->action.run()); nav.addView(button,new LinearLayout.LayoutParams(0,-2,1));
    }
    @Override public void onBackPressed() { if(web.canGoBack()) web.goBack(); else super.onBackPressed(); }
    @Override protected void onSaveInstanceState(Bundle state) { web.saveState(state); super.onSaveInstanceState(state); }
    @Override protected void onPause() { web.setVisibility(View.INVISIBLE); web.onPause(); background=true; super.onPause(); }
    @Override protected void onResume() { super.onResume(); if(web!=null) { web.onResume(); web.setVisibility(View.VISIBLE); if(background) { status.setText("Wrócono do panelu. Sprawdź stan połączenia."); background=false; } } }
    @Override protected void onDestroy() { web.destroy(); super.onDestroy(); }
}
