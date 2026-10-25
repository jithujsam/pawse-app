package app.detoxcompanion;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

/** Every few hours, reads latest.json from the releases repo and posts one notification per new version. */
public class UpdateWorker extends Worker {
    private static final String LATEST = "https://raw.githubusercontent.com/jithujsam/pawse-releases/main/latest.json";
    private static final String CHANNEL = "app-updates";
    private static final String PREFS = "updates";

    public UpdateWorker(Context c, WorkerParameters p) { super(c, p); }

    public static void schedule(Context c) {
        Constraints net = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(UpdateWorker.class, 6, TimeUnit.HOURS).setConstraints(net).build();
        WorkManager.getInstance(c).enqueueUniquePeriodicWork("update-check", ExistingPeriodicWorkPolicy.KEEP, req);
    }

    @Override
    public Result doWork() {
        Context c = getApplicationContext();
        try {
            HttpURLConnection h = (HttpURLConnection) new URL(LATEST + "?t=" + System.currentTimeMillis()).openConnection();
            h.setConnectTimeout(15000);
            h.setReadTimeout(15000);
            if (h.getResponseCode() != 200) return Result.retry();
            String body;
            try (InputStream in = h.getInputStream()) {
                ByteArrayOutputStream bo = new ByteArrayOutputStream();
                byte[] buf = new byte[4096]; int n;
                while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
                body = bo.toString("UTF-8");
            }
            JSONObject j = new JSONObject(body);
            long code = j.getLong("code");
            String name = j.getString("name");
            if (!j.optString("url").startsWith("https://")) return Result.success();
            PackageInfo pi = c.getPackageManager().getPackageInfo(c.getPackageName(), 0);
            long mine = Build.VERSION.SDK_INT >= 28 ? pi.getLongVersionCode() : pi.versionCode;
            SharedPreferences sp = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            if (code <= mine || code <= sp.getLong("notified", 0)) return Result.success();
            if (notify(c, name, j.optString("notes", ""))) sp.edit().putLong("notified", code).apply();
            return Result.success();
        } catch (Exception e) {
            return Result.retry();
        }
    }

    private static boolean notify(Context c, String name, String notes) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (!nm.areNotificationsEnabled()) return false;
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel(CHANNEL, "App updates", NotificationManager.IMPORTANCE_DEFAULT));
        Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        nm.notify(4001, new NotificationCompat.Builder(c, CHANNEL)
            .setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setContentTitle("Pawse " + name + " is ready")
            .setContentText(notes.isEmpty() ? "Open the app to update." : notes)
            .setContentIntent(pi).setAutoCancel(true).build());
        return true;
    }
}
