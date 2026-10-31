package app.detoxcompanion;

import android.content.Context;
import android.util.Base64;
import java.io.File;
import java.io.FileOutputStream;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Arrays;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/** Lets the web app hand the pet widgets their latest state: each pet's species, breed, mood and, when unlocked, name. */
@CapacitorPlugin(name = "Widget")
public class WidgetPlugin extends Plugin {
    static final int MAX_PETS = 12;
    static final int MAX_NAME = 24;
    static final List<String> SPECIES = Arrays.asList("dog", "cat", "rabbit", "fox", "owl", "panda");
    static final List<String> BREEDS = Arrays.asList("shiba", "husky");
    static final List<String> MOODS = Arrays.asList("happy", "idle", "sad");

    static final int MAX_FRAMES = 6;
    /** A frame is a 192 px PNG, well under this; anything bigger isn't ours. */
    static final int MAX_FRAME_CHARS = 400_000;

    /** Saves a pet's pictures as files the widgets read, and returns how many were kept. */
    private static int saveFrames(File dir, int pet, String set, JSONArray frames) {
        if (frames == null) return 0;
        int kept = 0;
        for (int i = 0; i < frames.length() && kept < MAX_FRAMES; i++) {
            String b64 = frames.optString(i, "");
            if (b64.isEmpty() || b64.length() > MAX_FRAME_CHARS) return 0;
            try {
                byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
                try (FileOutputStream out = new FileOutputStream(new File(dir, PetWidget.frameName(pet, set, kept)))) {
                    out.write(bytes);
                }
                kept++;
            } catch (Exception e) {
                return 0;
            }
        }
        return kept;
    }

    @PluginMethod
    public void update(PluginCall call) {
        Context c = getContext();
        JSONArray input = call.getData().optJSONArray("pets");
        JSONArray pets = new JSONArray();
        // Start the pictures afresh: pets that were removed or changed leave nothing behind.
        File dir = new File(c.getFilesDir(), PetWidget.FRAME_DIR);
        File[] old = dir.listFiles();
        if (old != null) for (File f : old) f.delete();
        dir.mkdirs();
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
                    String breed = pet.optString("breed", "");
                    if (BREEDS.contains(breed)) clean.put("breed", breed);
                    int n = saveFrames(dir, pets.length(), "a", pet.optJSONArray("frames"));
                    int idle = saveFrames(dir, pets.length(), "i", pet.optJSONArray("idleFrames"));
                    if (n > 0) clean.put("frames", n);
                    if (idle > 0) clean.put("idle", idle);
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
