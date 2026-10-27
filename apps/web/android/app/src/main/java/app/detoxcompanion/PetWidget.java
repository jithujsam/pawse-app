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
import android.widget.RemoteViews;
import androidx.core.content.ContextCompat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Shared behaviour of the home screen pet widgets: one page per pet, shown one at a time. The pages slide on their own,
 * and the arrows step through them. Each page's frames cycle, with the pet's name under it when the app has sent one.
 * Tapping the pet opens the check-in.
 */
public abstract class PetWidget extends AppWidgetProvider {
    static final String PREFS = "companion_widget";
    static final String PETS = "pets";
    static final String DAY = "day";
    static final String PAGE = "page";
    static final String ACTION_STEP = "app.detoxcompanion.widget.STEP";
    static final String EXTRA_STEP = "step";
    static final int FRAMES = 6;
    /** The most pages a widget holds. Each page keeps its six frames in memory. */
    static final int MAX_PAGES = 6;
    static final int[] FRAME_IDS = {
        R.id.widget_frame_0, R.id.widget_frame_1, R.id.widget_frame_2,
        R.id.widget_frame_3, R.id.widget_frame_4, R.id.widget_frame_5,
    };

    /** The layout for this widget's size and background. */
    abstract int layout();

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        manager.updateAppWidget(ids, render(context, getClass(), layout()));
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!ACTION_STEP.equals(intent.getAction())) {
            super.onReceive(context, intent);
            return;
        }
        int count = Math.min(pets(context).length(), MAX_PAGES);
        if (count > 0) {
            int page = ((storedPage(context) + intent.getIntExtra(EXTRA_STEP, 1)) % count + count) % count;
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putInt(PAGE, page).apply();
        }
        refresh(context);
    }

    static RemoteViews render(Context context, Class<?> provider, int layout) {
        RemoteViews v = new RemoteViews(context.getPackageName(), layout);
        JSONArray pets = pets(context);
        int count = Math.min(pets.length(), MAX_PAGES);
        boolean today = moodsAreToday(context);
        // "Remove animations" in the phone's settings: one still frame instead of the cycle.
        boolean still = Settings.Global.getFloat(context.getContentResolver(), Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f;
        // The solid card is light or dark with the theme, so its text follows that; the clear one sits on the wallpaper.
        int nameColor = layout == R.layout.companion_widget
            ? ContextCompat.getColor(context, R.color.widget_name)
            : Color.WHITE;
        v.removeAllViews(R.id.widget_pages);
        for (int i = 0; i < count; i++) v.addView(R.id.widget_pages, petView(context, pets.optJSONObject(i), today, still, nameColor));
        if (count > 0) v.setDisplayedChild(R.id.widget_pages, ((storedPage(context) % count) + count) % count);
        v.setViewVisibility(R.id.widget_pages, count > 0 ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.widget_empty, count == 0 ? View.VISIBLE : View.GONE);
        // Arrows only make sense with more than one pet.
        int arrows = count > 1 ? View.VISIBLE : View.GONE;
        v.setViewVisibility(R.id.widget_prev, arrows);
        v.setViewVisibility(R.id.widget_next, arrows);
        v.setTextColor(R.id.widget_prev, nameColor);
        v.setTextColor(R.id.widget_next, nameColor);
        v.setOnClickPendingIntent(R.id.widget_prev, step(context, provider, -1, 2));
        v.setOnClickPendingIntent(R.id.widget_next, step(context, provider, 1, 3));
        // Anywhere else on the widget opens the check-in.
        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse("app.detoxcompanion://open/quick"), context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tap = PendingIntent.getActivity(context, 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.widget_pages, tap);
        v.setOnClickPendingIntent(R.id.widget_empty, tap);
        return v;
    }

    /** A broadcast to this widget that moves the page by `delta`, for the arrow buttons. */
    static PendingIntent step(Context context, Class<?> provider, int delta, int requestCode) {
        Intent intent = new Intent(ACTION_STEP, null, context, provider).putExtra(EXTRA_STEP, delta);
        return PendingIntent.getBroadcast(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
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

    /** Called by WidgetPlugin when the app has new pet state, and by the arrows: every pet widget redraws. */
    static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        new CompanionWidget().onUpdate(context, manager, manager.getAppWidgetIds(new ComponentName(context, CompanionWidget.class)));
        new CompanionWidgetClear().onUpdate(context, manager, manager.getAppWidgetIds(new ComponentName(context, CompanionWidgetClear.class)));
    }

    /** The page the arrows last moved to. Both widgets share it. */
    static int storedPage(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getInt(PAGE, 0);
    }

    /** The stored pets as a JSON array of {species, mood, name?}. Empty when nothing has been written yet. */
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
