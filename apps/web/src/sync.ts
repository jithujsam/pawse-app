import { getData, actions, subscribe } from "./store";
import { supabase } from "./supabase";
import type { AppData } from "./types";

let timer: ReturnType<typeof setTimeout> | undefined;
let userId: string | null = null;
let applying = false;

async function push() {
  if (!supabase || !userId) return;
  const d = getData();
  await supabase.from("app_state").upsert({ user_id: userId, data: d, updated_at: new Date(d.updatedAt || Date.now()).toISOString() });
}

/** Pulls the saved copy once on sign-in (newer wins), then keeps the account copy fresh. */
export async function startSync(uid: string): Promise<void> {
  if (!supabase) return;
  userId = uid;
  const { data } = await supabase.from("app_state").select("data").eq("user_id", uid).maybeSingle();
  const remote = data?.data as AppData | undefined;
  if (remote && remote.v === 1 && remote.settings?.onboarded && (remote.updatedAt ?? 0) > (getData().updatedAt ?? 0)) {
    applying = true; actions.replaceAll(remote); applying = false;
  } else if (getData().settings.onboarded) await push();
}
export const stopSync = () => { userId = null; clearTimeout(timer); };

subscribe(() => {
  if (applying || !userId) return;
  clearTimeout(timer);
  timer = setTimeout(() => { void push(); }, 2500);
});
