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
 * The file is kept in the app's private cache as Pawse-<sha256>.apk: if the person backs out of the installer and taps
 * Update again, a copy that still matches its checksum is used instead of downloading it again. Any other update file,
 * and any older than KEEP_DAYS, is deleted, so the downloads never pile up.
 */
@CapacitorPlugin(name = "Updater")
public class UpdaterPlugin extends Plugin {
    private static final String HOST = "raw.githubusercontent.com";
    private static final long KEEP_MS = 3L * 24 * 60 * 60 * 1000;
    private volatile boolean busy = false;

    private File updatesDir() { return new File(getContext().getCacheDir(), "updates"); }

    private static String fileName(String sha) { return "Pawse-" + sha.toLowerCase() + ".apk"; }

    private static String sha256Of(File f) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new java.io.FileInputStream(f)) {
            byte[] buf = new byte[64 * 1024]; int n;
            while ((n = in.read(buf)) > 0) md.update(buf, 0, n);
        }
        StringBuilder hex = new StringBuilder();
        for (byte b : md.digest()) hex.append(String.format("%02x", b));
        return hex.toString();
    }

    /** Deletes update files older than KEEP_MS, and (when `keep` is given) every other update file too. */
    private void tidy(String keep) {
        File[] files = updatesDir().listFiles();
        if (files == null) return;
        long now = System.currentTimeMillis();
        for (File f : files) if ((keep != null && !f.getName().equals(keep)) || now - f.lastModified() > KEEP_MS) f.delete();
    }

    @Override
    public void load() {
        new Thread(() -> tidy(null)).start();
    }

    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url", "");
        String sha = call.getString("sha256", "");
        if (!isAllowed(url) || sha == null || !sha.matches("[0-9a-fA-F]{64}")) { call.reject("bad-request"); return; }
        if (busy) { call.reject("busy"); return; }
        busy = true;
        new Thread(() -> {
            File dir = updatesDir();
            File out = new File(dir, fileName(sha));
            try {
                if (!dir.exists() && !dir.mkdirs()) throw new Exception("storage");
                tidy(out.getName());
                // Already downloaded and still intact: use it.
                if (out.exists() && sha256Of(out).equalsIgnoreCase(sha)) {
                    JSObject p = new JSObject(); p.put("percent", 100); notifyListeners("progress", p);
                    out.setLastModified(System.currentTimeMillis());
                    call.resolve();
                    return;
                }
                out.delete();
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
        String sha = call.getString("sha256", "");
        if (sha == null || !sha.matches("[0-9a-fA-F]{64}")) { call.reject("bad-request"); return; }
        File apk = new File(updatesDir(), fileName(sha));
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
