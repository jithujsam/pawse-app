package app.detoxcompanion;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;

/**
 * Home screen widget: the companion, its name and one line about today.
 * The app writes the latest state through WidgetPlugin; tapping opens the check-in.
 */
public class CompanionWidget extends AppWidgetProvider {
    static final String PREFS = "companion_widget";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, render(context));
    }

    static RemoteViews render(Context context) {
        SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String species = p.getString("species", "dog");
        boolean sad = p.getBoolean("sad", false);
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.companion_widget);
        int art = context.getResources().getIdentifier("pet_" + species + (sad ? "_sad" : ""), "drawable", context.getPackageName());
        if (art != 0) v.setImageViewResource(R.id.widget_pet, art);
        v.setTextViewText(R.id.widget_name, p.getString("name", "Companion"));
        v.setTextViewText(R.id.widget_line, p.getString("line", "Tap to check in"));
        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse("app.detoxcompanion://open/quick"), context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tap = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.widget_root, tap);
        return v;
    }

    static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, CompanionWidget.class));
        for (int id : ids) manager.updateAppWidget(id, render(context));
    }
}
