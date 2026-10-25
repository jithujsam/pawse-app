package app.detoxcompanion;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;

/**
 * Downloads the new APK from the releases repo, checks its SHA-256, and hands it to Android's installer.
 * Android always shows its own confirm screen; the update installs over the app only because it is signed with the same key.
 */
@CapacitorPlugin(name = "Updater")
public class UpdaterPlugin extends Plugin {
    private static final String HOST = "raw.githubusercontent.com";
    private volatile boolean busy = false;

    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url", "");
        String sha = call.getString("sha256", "");
        if (!isAllowed(url) || sha == null || !sha.matches("[0-9a-fA-F]{64}")) { call.reject("bad-request"); return; }
        if (busy) { call.reject("busy"); return; }
        busy = true;
        new Thread(() -> {
            File dir = new File(getContext().getCacheDir(), "updates");
            File out = new File(dir, "Pawse-update.apk");
            try {
                if (!dir.exists() && !dir.mkdirs()) throw new Exception("storage");
                File[] old = dir.listFiles();
                if (old != null) for (File f : old) f.delete();
                HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                c.setConnectTimeout(15000);
                c.setReadTimeout(30000);
                if (c.getResponseCode() != 200) throw new Exception("http");
                // Redirects are followed by HttpURLConnection only within the same protocol; make sure we stayed on https.
                if (!"https".equals(c.getURL().getProtocol())) throw new Exception("http");
                long total = c.getContentLengthLong();
                MessageDigest md = MessageDigest.getInstance("SHA-256");
                long got = 0; int lastPct = -1;
                try (InputStream in = c.getInputStream(); FileOutputStream fo = new FileOutputStream(out)) {
                    byte[] buf = new byte[32 * 1024]; int n;
                    while ((n = in.read(buf)) > 0) {
                        fo.write(buf, 0, n); md.update(buf, 0, n); got += n;
                        int pct = total > 0 ? (int) (got * 100 / total) : -1;
                        if (pct != lastPct) { lastPct = pct; JSObject p = new JSObject(); p.put("percent", pct); notifyListeners("progress", p); }
                    }
                }
                StringBuilder hex = new StringBuilder();
                for (byte b : md.digest()) hex.append(String.format("%02x", b));
                if (!hex.toString().equalsIgnoreCase(sha)) { out.delete(); throw new Exception("checksum"); }
                call.resolve();
            } catch (Exception e) {
                out.delete();
                call.reject(e.getMessage() == null ? "failed" : e.getMessage());
            } finally {
                busy = false;
            }
        }).start();
    }

    /** Opens the installer for the downloaded file. Rejects with "permission" after opening the "install unknown apps" setting. */
    @PluginMethod
    public void install(PluginCall call) {
        File apk = new File(new File(getContext().getCacheDir(), "updates"), "Pawse-update.apk");
        if (!apk.exists()) { call.reject("missing"); return; }
        if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent s = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            s.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(s);
            call.reject("permission");
            return;
        }
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
        Intent i = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    private static boolean isAllowed(String url) {
        try { Uri u = Uri.parse(url); return "https".equals(u.getScheme()) && HOST.equals(u.getHost()); } catch (Exception e) { return false; }
    }
}
