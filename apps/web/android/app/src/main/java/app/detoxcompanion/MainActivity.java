package app.detoxcompanion;

import android.os.Bundle;
import androidx.work.WorkManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetPlugin.class);
        registerPlugin(UpdaterPlugin.class);
        super.onCreate(savedInstanceState);
        // Older installs still have the retired background update check scheduled; stop it. Updates are offered in the app now.
        WorkManager.getInstance(this).cancelUniqueWork("update-check");
    }
}
