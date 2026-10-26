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

/** Lets the web app hand the pet widgets their latest state: each pet's species and mood, nothing else. */
@CapacitorPlugin(name = "Widget")
public class WidgetPlugin extends Plugin {
    static final int MAX_PETS = 12;
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
                } catch (Exception e) {
                    continue;
                }
                pets.put(clean);
            }
        }
        c.getSharedPreferences(PetWidget.PREFS, Context.MODE_PRIVATE).edit().putString(PetWidget.PETS, pets.toString()).apply();
        PetWidget.refresh(c);
        call.resolve();
    }
}
