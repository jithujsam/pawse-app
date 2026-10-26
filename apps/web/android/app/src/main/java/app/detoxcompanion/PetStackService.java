package app.detoxcompanion;

import android.content.Context;
import android.content.Intent;
import android.provider.Settings;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;
import org.json.JSONArray;
import org.json.JSONObject;

/** Feeds the pet widgets' stack: one card per pet, each card's frames cycling in the item layout. */
public class PetStackService extends RemoteViewsService {
    static final int FRAMES = 6;
    static final int[] FRAME_IDS = {
        R.id.widget_frame_0, R.id.widget_frame_1, R.id.widget_frame_2,
        R.id.widget_frame_3, R.id.widget_frame_4, R.id.widget_frame_5,
    };

    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new PetFactory(getApplicationContext());
    }

    static class PetFactory implements RemoteViewsFactory {
        private final Context context;
        private JSONArray pets = new JSONArray();
        private boolean today;
        private boolean still;

        PetFactory(Context context) {
            this.context = context;
        }

        @Override public void onCreate() { }

        @Override
        public void onDataSetChanged() {
            try {
                pets = new JSONArray(PetWidget.storedPets(context));
            } catch (Exception e) {
                pets = new JSONArray();
            }
            today = PetWidget.moodsAreToday(context);
            // "Remove animations" in the phone's settings: one still frame instead of the cycle.
            still = Settings.Global.getFloat(context.getContentResolver(), Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f;
        }

        @Override public void onDestroy() { }

        @Override
        public int getCount() {
            return pets.length();
        }

        @Override
        public RemoteViews getViewAt(int position) {
            RemoteViews v = new RemoteViews(context.getPackageName(), still ? R.layout.widget_pet_still : R.layout.widget_pet_item);
            JSONObject pet = pets.optJSONObject(position);
            if (pet == null) return v;
            String species = pet.optString("species", "dog");
            String mood = today ? pet.optString("mood", "idle") : "idle";
            for (int i = 0; i < (still ? 1 : FRAMES); i++) {
                int art = context.getResources().getIdentifier("widget_" + species + "_" + mood + "_" + i, "drawable", context.getPackageName());
                if (art != 0) v.setImageViewResource(FRAME_IDS[i], art);
            }
            v.setOnClickFillInIntent(R.id.widget_item, new Intent());
            return v;
        }

        @Override public RemoteViews getLoadingView() { return null; }

        @Override public int getViewTypeCount() { return 2; }

        @Override public long getItemId(int position) { return position; }

        @Override public boolean hasStableIds() { return true; }
    }
}
