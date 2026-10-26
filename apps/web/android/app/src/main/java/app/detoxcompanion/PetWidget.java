package app.detoxcompanion;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.provider.Settings;
import android.view.View;
import androidx.core.content.ContextCompat;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Shared behaviour of the home screen pet widgets: one fixed slot per pet, up to four, top to bottom. Each slot shows
 * its pet's frames cycling, with the pet's name under it when the app has sent one. Tapping opens the check-in.
 */
public abstract class PetWidget extends AppWidgetProvider {
    static final String PREFS = "companion_widget";
    static final String PETS = "pets";
    static final String DAY = "day";
    static final int FRAMES = 6;
    static final int[] FRAME_IDS = {
        R.id.widget_frame_0, R.id.widget_frame_1, R.id.widget_frame_2,
        R.id.widget_frame_3, R.id.widget_frame_4, R.id.widget_frame_5,
    };
    /** The pet slots in the widget's layout. A pet past the last slot isn't shown. */
    static final int[] SLOTS = { R.id.widget_slot_0, R.id.widget_slot_1, R.id.widget_slot_2, R.id.widget_slot_3 };

    /** The layout for this widget's size and background. */
    abstract int layout();

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        manager.updateAppWidget(ids, render(context, layout()));
    }

    static RemoteViews render(Context context, int layout) {
        RemoteViews v = new RemoteViews(context.getPackageName(), layout);
        JSONArray pets = pets(context);
        boolean today = moodsAreToday(context);
        // "Remove animations" in the phone's settings: one still frame instead of the cycle.
        boolean still = Settings.Global.getFloat(context.getContentResolver(), Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f;
        // The solid card is light or dark with the theme, so its name follows that; the clear one sits on the wallpaper.
        int nameColor = layout == R.layout.companion_widget
            ? ContextCompat.getColor(context, R.color.widget_name)
            : Color.WHITE;
        int shown = Math.min(pets.length(), SLOTS.length);
        for (int i = 0; i < SLOTS.length; i++) {
            v.removeAllViews(SLOTS[i]);
            if (i < shown) v.addView(SLOTS[i], petView(context, pets.optJSONObject(i), today, still, nameColor));
            v.setViewVisibility(SLOTS[i], i < shown ? View.VISIBLE : View.GONE);
        }
        v.setViewVisibility(R.id.widget_empty, shown == 0 ? View.VISIBLE : View.GONE);
        // Any part of the widget opens the check-in.
        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse("app.detoxcompanion://open/quick"), context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tap = PendingIntent.getActivity(context, 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        for (int slot : SLOTS) v.setOnClickPendingIntent(slot, tap);
        v.setOnClickPendingIntent(R.id.widget_empty, tap);
        return v;
    }

    /** One pet, as its own view: its frames cycle here, or one still frame when animations are off, then its name. */
    static RemoteViews petView(Context context, JSONObject pet, boolean today, boolean still, int nameColor) {
        RemoteViews p = new RemoteViews(context.getPackageName(), still ? R.layout.widget_pet_still : R.layout.widget_pet_item);
        if (pet == null) return p;
        String species = pet.optString("species", "dog");
        String mood = today ? pet.optString("mood", "idle") : "idle";
        for (int i = 0; i < (still ? 1 : FRAMES); i++) {
            int art = context.getResources().getIdentifier("widget_" + species + "_" + mood + "_" + i, "drawable", context.getPackageName());
            if (art != 0) p.setImageViewResource(FRAME_IDS[i], art);
        }
        String name = pet.optString("name", "");
        p.setTextViewText(R.id.widget_name, name);
        p.setTextColor(R.id.widget_name, nameColor);
        p.setViewVisibility(R.id.widget_name, name.isEmpty() ? View.GONE : View.VISIBLE);
        return p;
    }

    /** Called by WidgetPlugin when the app has new pet state: every pet widget redraws. */
    static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        new CompanionWidget().onUpdate(context, manager, manager.getAppWidgetIds(new ComponentName(context, CompanionWidget.class)));
        new CompanionWidgetClear().onUpdate(context, manager, manager.getAppWidgetIds(new ComponentName(context, CompanionWidgetClear.class)));
    }

    /** The stored pets as a JSON array of {species, mood}. Empty when nothing has been written yet. */
    static JSONArray pets(Context context) {
        SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            return new JSONArray(p.getString(PETS, "[]"));
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    /** Whether the stored moods are about today. After midnight they are yesterday's, so the pets show idle until the app opens. */
    static boolean moodsAreToday(Context context) {
        String day = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(DAY, "");
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date()).equals(day);
    }
}
