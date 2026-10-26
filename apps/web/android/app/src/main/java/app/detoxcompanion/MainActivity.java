package app.detoxcompanion;

import android.os.Bundle;
import android.webkit.WebSettings;
import androidx.work.WorkManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetPlugin.class);
        registerPlugin(UpdaterPlugin.class);
        super.onCreate(savedInstanceState);
        // An app, not a web page: no pinch-zoom and no zoom buttons.
        WebSettings web = getBridge().getWebView().getSettings();
        web.setSupportZoom(false);
        web.setBuiltInZoomControls(false);
        web.setDisplayZoomControls(false);
        // Older installs still have the retired background update check scheduled; stop it. Updates are offered in the app now.
        WorkManager.getInstance(this).cancelUniqueWork("update-check");
    }
}
