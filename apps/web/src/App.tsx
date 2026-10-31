import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { startSync, useSyncStatus } from "./sync";
import { kv } from "./db";
import { Restoring, Welcome } from "./screens/Welcome";
import { NewPassword } from "./screens/Account";
import { onReminderTap, updateNotifications } from "./notify";
import { useSession } from "./supabase";
import { trackSummary } from "./progress";
import { trackState } from "./tracks";
import { actions, onPinChange, reminderInputs, useActiveView, useData, vault, viewCompanion, type Boot } from "./store";
import { LockScreen } from "./screens/Lock";
import type { Sealed } from "./vault";
import { haptic } from "./haptics";
import { fade, spring } from "./motion";
import { Home } from "./screens/Home";
import { Pets } from "./screens/Pets";

// Only Pets and the open track (Home) ship in the first bundle; the rest load on first visit.
const Onboarding = lazy(() => import("./screens/Onboarding").then((m) => ({ default: m.Onboarding })));
const Journey = lazy(() => import("./screens/Journey").then((m) => ({ default: m.Journey })));
const Report = lazy(() => import("./screens/Report").then((m) => ({ default: m.Report })));
const Me = lazy(() => import("./screens/Me").then((m) => ({ default: m.Me })));
const Memorial = lazy(() => import("./screens/Memorial").then((m) => ({ default: m.Memorial })));
const prefetch = () => { void import("./screens/Journey"); void import("./screens/Report"); void import("./screens/Me"); };
import { ToastHost } from "./ui/Toast";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import { listenForBack, useRootBack } from "./back";
import { QuickSheet } from "./screens/QuickSheet";
import { PlanPage } from "./screens/Plan";
import { SubPage } from "./ui/Settings";
import { Icon, PawLoader } from "./ui/Controls";
import { OPEN_QUICK, updateWidget } from "./widget";
import { today } from "./dates";
import { applyLook } from "./look";
import { UpdateDialog } from "./ui/UpdateDialog";
import { Tutorial } from "./ui/Tutorial";
import { useUpdatePending } from "./update";
import { t } from "./text";
import { APP_NAME } from "./brand";

/** One run of the loading paw (.paw-load in styles.css). The boot splash lifts only at the end of a run. */
const PAW_RUN_MS = 1400;
/** A phone still going through onboarding waits for the first sync (to find a restore) for no longer than this. */
const BOOT_WAIT_MS = 6_000;

export type Tab = "pets" | "calendar" | "insights" | "you";
const TABS: Tab[] = ["pets", "calendar", "insights", "you"];

const ICONS: Record<Tab, React.JSX.Element> = {
  pets: <svg viewBox="0 0 24 24"><circle cx="5.5" cy="10" r="2" /><circle cx="9.5" cy="5.5" r="2" /><circle cx="14.5" cy="5.5" r="2" /><circle cx="18.5" cy="10" r="2" /><path d="M12 11c-3 0-6 4.5-6 7a2.5 2.5 0 0 0 3.5 2.3c1.6-.7 3.4-.7 5 0A2.5 2.5 0 0 0 18 18c0-2.5-3-7-6-7z" /></svg>,
  calendar: <svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>,
  insights: <svg viewBox="0 0 24 24"><path d="M5 20V10M12 20V4M19 20v-7" /></svg>,
  you: <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></svg>,
};
const LABELS: Record<Tab, string> = { pets: t("nav.tabs.pets"), calendar: t("nav.tabs.calendar"), insights: t("nav.tabs.insights"), you: t("nav.tabs.me") };
listenForBack();

const LOCK_AFTER: Record<string, number> = { immediately: 0, "1m": 60_000, "5m": 300_000, never: Infinity };

export function App({ boot }: { boot: Boot }) {
  const [lock, setLock] = useState<{ sealed?: Sealed; length: number } | null>(boot.kind === "locked" ? { sealed: boot.sealed, length: 4 } : null);
  const data = useData();
  const autoLock = data.settings.autoLock;

  useEffect(() => { if (boot.kind === "locked") void vault.pinLength().then((length) => setLock((l) => l && { ...l, length })); }, [boot.kind]);
  useEffect(() => {
    let hiddenAt = 0;
    const onVis = () => {
      if (document.visibilityState === "hidden") { hiddenAt = Date.now(); document.body.classList.toggle("privacy", vault.hasPin()); return; }
      document.body.classList.remove("privacy");
      if (vault.hasPin() && hiddenAt && Date.now() - hiddenAt >= (LOCK_AFTER[autoLock ?? "1m"] ?? 60_000)) {
        void vault.pinLength().then((length) => setLock({ length }));
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [autoLock]);

  return (
    <MotionConfig reducedMotion="user">
      <ErrorBoundary>
        <AnimatePresence mode="wait">
          {lock
            ? <div className="app" key="lock"><LockScreen sealed={lock.sealed} pinLength={lock.length} onUnlock={() => setLock(null)} /></div>
            : <Shell key="shell" />}
        </AnimatePresence>
      </ErrorBoundary>
      <ToastHost />
    </MotionConfig>
  );
}

/** Re-renders at local midnight, so an app left open rolls over to the new day (today's check-in, week strip, streak). */
function useMidnight() {
  const [, setDay] = useState(today());
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const arm = () => {
      const next = new Date(); next.setHours(24, 0, 1, 0);
      t = setTimeout(() => { setDay(today()); arm(); }, Math.min(next.getTime() - Date.now(), 2 ** 31 - 1));
    };
    arm();
    // Phones suspend timers in the background; check again whenever the app comes back.
    const onVis = () => { if (document.visibilityState === "visible") setDay(today()); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearTimeout(t); document.removeEventListener("visibilitychange", onVis); };
  }, []);
}

function Shell() {
  useMidnight();
  const data = useData();
  const view = useActiveView();
  const [tab, setTab] = useState<Tab>("pets");
  // Inside the Pets tab: the grid, or one recovery track (the companion home screen).
  const [track, setTrack] = useState(false);
  const openTrack = () => { setTab("pets"); setTrack(true); };
  const [quick, setQuick] = useState(false);
  // The plan page for the pet chosen in the + menu.
  const [planHabit, setPlanHabit] = useState<string | null>(null);
  const dir = useRef(1);
  const appRef = useRef<HTMLDivElement>(null);
  // The shell eases in when the app opens and again when you come back to it after a while away.
  useEffect(() => {
    let hiddenAt = 0;
    const onVis = () => {
      if (document.visibilityState === "hidden") { hiddenAt = Date.now(); return; }
      const el = appRef.current;
      if (!el || !hiddenAt || Date.now() - hiddenAt < 2000) return;
      el.classList.remove("app-wake"); void el.offsetWidth; el.classList.add("app-wake");
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  const [memorialSeen, setMemorialSeen] = useState<string | null>(null);
  const { session, ready, recovering } = useSession();
  const updateDot = useUpdatePending() !== null;
  const [pwDone, setPwDone] = useState(false);
  const sync = useSyncStatus();
  // The restore check waits for the first sync to settle, once. A retry after that (offline, say) must not swap
  // onboarding out for it, or the person loses their place mid-step.
  const restoreSettled = useRef(false);
  if (sync.last !== null || sync.state === "error" || sync.state === "offline") restoreSettled.current = true;
  // The boot splash holds until the session check is done, then until the paw has finished a whole run, so nothing
  // is cut off mid-animation. A returning person's data is already on the phone, so the sync can carry on behind
  // the splash. Only a phone still in onboarding waits for the first sync, since that decides whether to restore.
  const [waited, setWaited] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setWaited(true), BOOT_WAIT_MS); return () => clearTimeout(timer); }, []);
  const syncSettled = sync.last !== null || sync.state === "error" || sync.state === "offline";
  const lifted = useRunLift(ready && (!session || data.settings.onboarded || syncSettled || waited));
  const species = view?.companion.species;
  useEffect(() => { if (species) document.documentElement.dataset.pet = species; }, [species]);
  const { theme, accent } = data.settings;
  useEffect(() => { applyLook(theme, accent); }, [theme, accent]);
  const uid = session?.user.id;
  useEffect(() => {
    if (!uid) return;
    void (async () => {
      // Data on this phone belongs to whoever signed in last. A different person starts clean.
      const owner = await kv.get<string>("owner").catch(() => undefined);
      if (owner && owner !== uid) await actions.resetAll();
      await kv.set("owner", uid).catch(() => undefined);
      await startSync(uid);
    })();
  }, [uid]);

  useEffect(() => onReminderTap(() => { dir.current = -1; openTrack(); }), []);
  // The home screen widget opens straight into the quick check-in.
  useEffect(() => { const open = () => { openTrack(); setQuick(true); }; window.addEventListener(OPEN_QUICK, open); return () => window.removeEventListener(OPEN_QUICK, open); }, []);
  // One notification plan for the whole app, for the open track. It is re-planned only when its inputs change,
  // so pausing or resuming from the Pets grid takes effect at once, without opening the track.
  const reminderKey = data.settings.onboarded ? JSON.stringify(reminderInputs(data)) : "";
  useEffect(() => { if (reminderKey) void updateNotifications(JSON.parse(reminderKey)); }, [reminderKey]);
  const [pinTick, setPinTick] = useState(0);
  useEffect(() => onPinChange(() => setPinTick((n) => n + 1)), []);
  useEffect(() => {
    if (!data.settings.onboarded) return;
    const t0 = today();
    // With app lock on, the home screen widgets show each pet with no mood, so nothing about today sits outside the PIN.
    const locked = vault.hasPin();
    const pets = data.companions.flatMap((c) => {
      const habit = data.habits.find((h) => h.companionId === c.id);
      if (!habit || viewCompanion(data, c.id, t0).dead) return [];
      const status = trackSummary(data, habit.id, t0).today;
      const paused = trackState(data, habit.id).status === "paused";
      const mood = locked || paused ? "idle" : status === "lapse" ? "sad" : status === "met" || status === "urge" ? "happy" : "idle";
      return [{ species: c.species, mood, ...(locked ? {} : { name: c.name }) } as const];
    });
    updateWidget(pets, t0);
  }, [data, pinTick]);
  // With no recovery track left (removed on another device, say), only the Pets grid makes sense.
  const hasTrack = !!view?.habit;
  useEffect(() => { if (!hasTrack) { setTab("pets"); setTrack(false); } }, [hasTrack]);
  useRootBack(() => {
    if (tab === "pets" && track) { dir.current = -1; setTrack(false); return true; }
    if (tab === "pets") return false;
    dir.current = -1; setTab("pets"); return true;
  });

  const go = (t: Tab) => {
    // Tapping Pets again goes back to the grid.
    if (t === tab) { if (t === "pets" && track) { dir.current = -1; setTrack(false); } return; }
    if (!view && t !== "pets") return;
    dir.current = TABS.indexOf(t) > TABS.indexOf(tab) ? 1 : -1;
    haptic.select();
    setTab(t);
  };

  useEffect(() => { if (data.settings.onboarded) { const t = setTimeout(prefetch, 1500); return () => clearTimeout(t); } }, [data.settings.onboarded]);

  if (!ready || !lifted) return <div className="app"><BootSplash /></div>;
  if (!session) return <div className="app"><Welcome /></div>;
  if (recovering && !pwDone) return <div className="app"><NewPassword onDone={() => setPwDone(true)} /></div>;
  if (!data.settings.onboarded && !restoreSettled.current && (sync.state === "off" || sync.state === "syncing")) return <div className="app"><Restoring /></div>;
  if (!data.settings.onboarded) return <div className="app"><Suspense fallback={<Loading />}><Onboarding /></Suspense></div>;

  if (view?.dead && memorialSeen !== view.companion.id) {
    return <div className="app"><Suspense fallback={<Loading />}><Memorial view={view} onDone={() => setMemorialSeen(view.companion.id)} /></Suspense></div>;
  }

  return (
    <div className="app app-wake" ref={appRef}>
      <div className="stage">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab === "pets" && track && view ? "track" : tab} className="stage-page" variants={fade} initial="enter" animate="center" exit="exit">
            <Suspense fallback={<GhostPage />}>
              {tab === "pets" && (track && view ? <WithTrack><Home onBack={() => { dir.current = -1; setTrack(false); }} /></WithTrack> : <Pets onOpen={() => { dir.current = 1; setTrack(true); }} />)}
              {tab === "calendar" && <WithTrack><Journey /></WithTrack>}
              {tab === "insights" && <WithTrack><Report /></WithTrack>}
              {tab === "you" && <WithTrack><Me /></WithTrack>}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </div>
      {sync.state === "offline" && (
        <div className="offline-bar" role="status">
          {sync.pending ? (sync.pending === 1 ? t("account.sync.offline_pending_one") : t("account.sync.offline_pending_other", { n: sync.pending })) : t("account.sync.offline")}
        </div>
      )}
      <nav className="tabbar" aria-label={t("nav.tabs.main")}>
        {TABS.flatMap((tabId, i) => {
          const button = (
            <button key={tabId} className="tab" data-tab={tabId} aria-current={tab === tabId ? "page" : undefined} onClick={() => go(tabId)}>
              <span className="tab-ico">{ICONS[tabId]}</span>
              <span className="tab-label">{LABELS[tabId]}</span>
              {tabId === "you" && updateDot && <span className="tab-dot" aria-hidden />}
            </button>
          );
          return i === 2 ? [
            <div key="fab" className="fab-slot">
              <motion.button className="fab" aria-label={t("nav.tabs.quick")} aria-haspopup="dialog" disabled={!view} onClick={() => { haptic.tap(); setQuick(true); }}
                whileTap={{ scale: 0.9 }} animate={{ rotate: quick ? 45 : 0 }} transition={spring.bouncy}>{Icon.plus}</motion.button>
            </div>, button] : [button];
        })}
      </nav>
      <QuickSheet open={quick} onClose={() => setQuick(false)} onPick={() => { setQuick(false); if (tab !== "pets" || !track) { dir.current = -1; openTrack(); } }} onPlan={(id) => { setQuick(false); setPlanHabit(id); }} />
      <UpdateDialog />
      <Tutorial firstRun />
      <SubPage open={planHabit !== null} title={t("me.profile.row_plan")} onClose={() => setPlanHabit(null)}>{planHabit && <PlanPage key={planHabit} habitId={planHabit} onSaved={() => setPlanHabit(null)} />}</SubPage>
    </div>
  );
}

/** Screens that show one recovery track render nothing once there is none, even mid-transition. */
function WithTrack({ children }: { children: React.ReactNode }) {
  return useActiveView()?.habit ? <>{children}</> : null;
}

/** A tab's code is still loading: plain placeholder blocks in the page layout, no motion. */
function GhostPage() {
  return (
    <main className="screen ghost-page" aria-busy="true" aria-label={t("nav.loading.loading")}>
      <span className="ghost ghost-title" />
      <span className="ghost ghost-line" />
      <div className="ghost-grid">
        <span className="ghost ghost-card" />
        <span className="ghost ghost-card" />
      </div>
    </main>
  );
}

/** While the app loads: the paw filling in, toe by toe. */
function Loading() {
  return <main className="screen center-screen" aria-busy="true" aria-label={t("nav.loading.loading")}><PawLoader /></main>;
}

/** The app opening: the paw, with the name just below it. */
function BootSplash() {
  return (
    <main className="screen center-screen boot" aria-busy="true" aria-label={t("nav.loading.boot")}>
      <PawLoader />
      <div className="brand boot-brand">{APP_NAME}</div>
    </main>
  );
}

/** True once `loaded` has been true and the paw has reached the end of a run. Once true it stays true. */
function useRunLift(loaded: boolean): boolean {
  const [started] = useState(() => performance.now());
  const [lift, setLift] = useState(false);
  useEffect(() => {
    if (!loaded) return;
    const elapsed = performance.now() - started;
    const runs = Math.max(1, Math.ceil(elapsed / PAW_RUN_MS));
    const timer = setTimeout(() => setLift(true), runs * PAW_RUN_MS - elapsed);
    return () => clearTimeout(timer);
  }, [loaded, started]);
  return lift;
}
