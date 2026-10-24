package app.detoxcompanion;

import android.content.Context;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Lets the web app hand the widget its latest state. Only short display strings are stored. */
@CapacitorPlugin(name = "Widget")
public class WidgetPlugin extends Plugin {
    @PluginMethod
    public void update(PluginCall call) {
        Context c = getContext();
        String species = call.getString("species", "dog");
        if (!species.matches("dog|cat|rabbit|fox|owl|panda")) species = "dog";
        c.getSharedPreferences(CompanionWidget.PREFS, Context.MODE_PRIVATE).edit()
            .putString("species", species)
            .putString("name", trim(call.getString("name", "Companion"), 20))
            .putString("line", trim(call.getString("line", ""), 60))
            .putBoolean("sad", Boolean.TRUE.equals(call.getBoolean("sad", false)))
            .apply();
        CompanionWidget.refresh(c);
        call.resolve();
    }

    private static String trim(String s, int max) { return s == null ? "" : s.length() > max ? s.substring(0, max) : s; }
}
