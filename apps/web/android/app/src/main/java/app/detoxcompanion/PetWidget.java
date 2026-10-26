package app.detoxcompanion;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.widget.RemoteViews;

/**
 * Shared behaviour of the home screen pet widgets: every pet the app has a track for, stacked. Each card shows the
 * pet's frames cycling, so it moves the way it does in the app. Tapping opens the check-in.
 */
public abstract class PetWidget extends AppWidgetProvider {
    static final String PREFS = "companion_widget";
    static final String PETS = "pets";

    /** The layout for this widget's size and background. */
    abstract int layout();

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, render(context, layout(), id));
        manager.notifyAppWidgetViewDataChanged(ids, R.id.widget_stack);
    }

    static RemoteViews render(Context context, int layout, int widgetId) {
        RemoteViews v = new RemoteViews(context.getPackageName(), layout);
        Intent service = new Intent(context, PetStackService.class);
        service.setData(Uri.parse("pawse-pets://" + widgetId));
        v.setRemoteAdapter(R.id.widget_stack, service);
        v.setEmptyView(R.id.widget_stack, R.id.widget_empty);
        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse("app.detoxcompanion://open/quick"), context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        // Items fill in their own click, so the stack's template must be mutable on Android 12 and later.
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0);
        PendingIntent tap = PendingIntent.getActivity(context, 0, open, flags);
        v.setPendingIntentTemplate(R.id.widget_stack, tap);
        v.setOnClickPendingIntent(R.id.widget_empty, PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        return v;
    }

    /** Called by WidgetPlugin when the app has new pet state: every pet widget reloads its stack. */
    static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (Class<?> c : new Class<?>[] { CompanionWidget.class, CompanionWidgetClear.class }) {
            int[] ids = manager.getAppWidgetIds(new ComponentName(context, c));
            if (ids.length > 0) manager.notifyAppWidgetViewDataChanged(ids, R.id.widget_stack);
        }
    }

    /** The stored pets as a JSON array of {species, mood}. Empty when nothing has been written yet. */
    static String storedPets(Context context) {
        SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return p.getString(PETS, "[]");
    }
}
