package app.detoxcompanion;

import android.content.Context;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Arrays;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/** Lets the web app hand the pet widgets their latest state: each pet's species, mood and, when unlocked, name. */
@CapacitorPlugin(name = "Widget")
public class WidgetPlugin extends Plugin {
    static final int MAX_PETS = 12;
    static final int MAX_NAME = 24;
    static final List<String> SPECIES = Arrays.asList("dog", "cat", "rabbit", "fox", "owl", "panda");
    static final List<String> MOODS = Arrays.asList("happy", "idle", "sad");

    @PluginMethod
    public void update(PluginCall call) {
        Context c = getContext();
        JSONArray input = call.getData().optJSONArray("pets");
        JSONArray pets = new JSONArray();
        if (input != null) {
            for (int i = 0; i < input.length() && pets.length() < MAX_PETS; i++) {
                JSONObject pet = input.optJSONObject(i);
                if (pet == null) continue;
                String species = pet.optString("species", "");
                String mood = pet.optString("mood", "");
                if (!SPECIES.contains(species) || !MOODS.contains(mood)) continue;
                JSONObject clean = new JSONObject();
                try {
                    clean.put("species", species);
                    clean.put("mood", mood);
                    String name = pet.optString("name", "").trim();
                    if (name.codePointCount(0, name.length()) > MAX_NAME) {
                        name = name.substring(0, name.offsetByCodePoints(0, MAX_NAME));
                    }
                    if (!name.isEmpty()) clean.put("name", name);
                } catch (Exception e) {
                    continue;
                }
                pets.put(clean);
            }
        }
        // The app's own today, so the widgets can tell when the moods are from an earlier day.
        String day = call.getString("day", "");
        if (day == null || !day.matches("\\d{4}-\\d{2}-\\d{2}")) day = "";
        c.getSharedPreferences(PetWidget.PREFS, Context.MODE_PRIVATE).edit()
            .putString(PetWidget.PETS, pets.toString())
            .putString(PetWidget.DAY, day)
            // Left over from the single-pet widget before 3.8.3.
            .remove("species").remove("name").remove("line").remove("sad")
            .apply();
        PetWidget.refresh(c);
        call.resolve();
    }
}
