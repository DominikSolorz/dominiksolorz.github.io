package pl.solorz.homesecurity;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import org.json.JSONObject;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/** Foreground update checks. Installation is always confirmed by Android. */
public final class AppUpdater {
    private static final String MANIFEST="https://dominiksolorz.github.io/kamera/android-update.json";
    private static final long INTERVAL=10*60*1000L;
    private final Activity activity;
    private final Handler ui=new Handler(Looper.getMainLooper());
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final AtomicBoolean busy=new AtomicBoolean();
    private boolean resumed=false,closed=false;
    private long offered=0;
    private File ready;
    private AlertDialog dialog;
    private final Runnable timer=new Runnable(){ public void run(){ check(false); if(resumed&&!closed) ui.postDelayed(this,INTERVAL); }};
    public AppUpdater(Activity activity){this.activity=activity;}
    public void resume(){resumed=true;ui.removeCallbacks(timer);ui.post(timer);if(ready!=null&&activity.getPackageManager().canRequestPackageInstalls())installReady();}
    public void pause(){resumed=false;ui.removeCallbacks(timer);if(dialog!=null){dialog.dismiss();dialog=null;}}
    public void close(){pause();closed=true;worker.shutdownNow();}
    private void message(String text){if(resumed&&!closed)Toast.makeText(activity,text,Toast.LENGTH_LONG).show();}
    public void check(boolean manual){
        if(closed||!busy.compareAndSet(false,true))return;
        worker.execute(()->{
            try{
                JSONObject data;
                HttpURLConnection c=(HttpURLConnection)new URL(MANIFEST).openConnection();
                c.setConnectTimeout(10000);c.setReadTimeout(15000);c.setInstanceFollowRedirects(false);
                c.setRequestProperty("Cache-Control","no-cache");
                try{
                    if(c.getResponseCode()!=200)throw new IOException("manifest");
                    try(InputStream in=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
                        byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1){if(out.size()+n>32768)throw new IOException("manifest size");out.write(b,0,n);}
                        data=new JSONObject(out.toString("UTF-8"));
                    }
                }finally{c.disconnect();}
                if(!data.optBoolean("enabled",false)){ui.post(()->{if(manual)message("Kanał aktualizacji APK nie jest jeszcze uruchomiony.");});return;}
                long version=data.getLong("versionCode"),size=data.getLong("size");
                String pkg=data.getString("packageName"),url=data.getString("url"),hash=data.getString("sha256");
                if(!UpdatePolicy.valid(pkg,activity.getPackageName(),version,BuildConfig.VERSION_CODE,url,hash,size)){
                    if(version<=BuildConfig.VERSION_CODE&&pkg.equals(activity.getPackageName()))ui.post(()->{if(manual)message("Masz aktualną wersję aplikacji.");});
                    return;
                }
                String name=data.getString("versionName");
                if(name.length()>40)throw new IOException("version name");
                ui.post(()->{
                    if(!resumed||closed||(!manual&&offered==version))return;
                    offered=version;
                    dialog=new AlertDialog.Builder(activity).setTitle("Aktualizacja HOME SECURITY "+name)
                        .setMessage("Pobrać nową wersję aplikacji? Plik i podpis zostaną sprawdzone. Android poprosi o potwierdzenie instalacji. Dane aplikacji pozostaną zachowane.")
                        .setNegativeButton("Później",(d,w)->dialog=null)
                        .setPositiveButton("Pobierz i zainstaluj",(d,w)->{dialog=null;download(url,hash,size,version);}).show();
                });
            }catch(Exception failure){ui.post(()->{if(manual)message("Nie udało się sprawdzić aktualizacji. Spróbuj ponownie po połączeniu z internetem.");});}
            finally{busy.set(false);}
        });
    }
    private InputStream downloadStream(String address)throws IOException{
        String current=address;
        for(int hop=0;hop<5;hop++){
            if(!UpdatePolicy.trustedTransport(current))throw new IOException("download origin");
            HttpURLConnection c=(HttpURLConnection)new URL(current).openConnection();
            c.setConnectTimeout(10000);c.setReadTimeout(30000);c.setInstanceFollowRedirects(false);
            int code=c.getResponseCode();
            if(code==301||code==302||code==303||code==307||code==308){String target=c.getHeaderField("Location");c.disconnect();if(target==null)throw new IOException("redirect");current=new URL(new URL(current),target).toString();continue;}
            if(code!=200){c.disconnect();throw new IOException("download status");}
            return new FilterInputStream(c.getInputStream()){@Override public void close()throws IOException{try{super.close();}finally{c.disconnect();}}};
        }
        throw new IOException("redirect limit");
    }
    private void download(String url,String hash,long size,long version){
        if(closed||!busy.compareAndSet(false,true))return;
        message("Pobieranie aktualizacji…");
        worker.execute(()->{
            File temp=null;
            try{
                File dir=new File(activity.getCacheDir(),"apk-updates");
                if(!dir.isDirectory()&&!dir.mkdirs())throw new IOException("cache");
                temp=new File(dir,"update.apk");
                MessageDigest digest=MessageDigest.getInstance("SHA-256");
                long total=0;
                try(InputStream in=downloadStream(url);OutputStream out=new FileOutputStream(temp)){
                    byte[] b=new byte[32768];int n;
                    while((n=in.read(b))!=-1){if(Thread.currentThread().isInterrupted())throw new IOException("cancelled");total+=n;if(total>size)throw new IOException("size");digest.update(b,0,n);out.write(b,0,n);}
                }
                if(total!=size||!UpdatePolicy.hex(digest.digest()).equalsIgnoreCase(hash))throw new IOException("hash");
                PackageManager pm=activity.getPackageManager();
                PackageInfo candidate=pm.getPackageArchiveInfo(temp.getAbsolutePath(),PackageManager.GET_SIGNING_CERTIFICATES);
                PackageInfo own=pm.getPackageInfo(activity.getPackageName(),PackageManager.GET_SIGNING_CERTIFICATES);
                if(candidate==null||!activity.getPackageName().equals(candidate.packageName)||candidate.getLongVersionCode()!=version
                    ||candidate.getLongVersionCode()<=own.getLongVersionCode()||candidate.signingInfo==null||own.signingInfo==null
                    ||!Arrays.equals(candidate.signingInfo.getApkContentsSigners(),own.signingInfo.getApkContentsSigners()))
                    throw new IOException("package or signing certificate");
                File verified=temp;
                ui.post(()->{if(!closed){ready=verified;if(resumed)installReady();}});
            }catch(Exception failed){if(temp!=null)temp.delete();ui.post(()->message("Aktualizacja nie przeszła sprawdzania lub pobieranie się nie udało. Obecna aplikacja działa dalej."));}
            finally{busy.set(false);}
        });
    }
    private void installReady(){
        if(ready==null||!resumed||closed||dialog!=null)return;
        if(!activity.getPackageManager().canRequestPackageInstalls()){
            dialog=new AlertDialog.Builder(activity).setTitle("Zezwolenie na aktualizacje APK")
                .setMessage("Android wymaga zezwolenia tej aplikacji na instalację aktualizacji. Po zmianie ustawienia wróć tutaj, aby potwierdzić instalację.")
                .setNegativeButton("Później",(d,w)->dialog=null)
                .setPositiveButton("Otwórz ustawienia",(d,w)->{
                    dialog=null;
                    try{activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+activity.getPackageName())));}
                    catch(android.content.ActivityNotFoundException e){message("Otwórz ustawienia instalowania aplikacji w Androidzie.");}
                }).show();
            return;
        }
        try{
            Uri uri=FileProvider.getUriForFile(activity,activity.getPackageName()+".updates",ready);
            Intent intent=new Intent(Intent.ACTION_VIEW).setDataAndType(uri,"application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            activity.startActivity(intent);ready=null;
        }catch(RuntimeException failed){message("Nie udało się otworzyć instalatora Androida.");}
    }
}
