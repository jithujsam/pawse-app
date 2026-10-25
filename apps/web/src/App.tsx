import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { startSync, useSyncStatus } from "./sync";
import { kv } from "./db";
import { Restoring, Welcome } from "./screens/Welcome";
import { NewPassword } from "./screens/Account";
import { onReminderTap } from "./notify";
import { useSession } from "./supabase";
import { trackSummary } from "./progress";
import { actions, onPinChange, useActiveView, useData, vault, type Boot } from "./store";
import { LockScreen } from "./screens/Lock";
import type { Sealed } from "./vault";
import { haptic } from "./haptics";
import { slide, spring } from "./motion";
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
import { Icon } from "./ui/Controls";
import { OPEN_QUICK, updateWidget } from "./widget";
import { today } from "./dates";
import { applyLook } from "./look";

export type Tab = "pets" | "calendar" | "insights" | "you";
const TABS: Tab[] = ["pets", "calendar", "insights", "you"];

const ICONS: Record<Tab, React.JSX.Element> = {
  pets: <svg viewBox="0 0 24 24"><circle cx="5.5" cy="10" r="2" /><circle cx="9.5" cy="5.5" r="2" /><circle cx="14.5" cy="5.5" r="2" /><circle cx="18.5" cy="10" r="2" /><path d="M12 11c-3 0-6 4.5-6 7a2.5 2.5 0 0 0 3.5 2.3c1.6-.7 3.4-.7 5 0A2.5 2.5 0 0 0 18 18c0-2.5-3-7-6-7z" /></svg>,
  calendar: <svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>,
  insights: <svg viewBox="0 0 24 24"><path d="M5 20V10M12 20V4M19 20v-7" /></svg>,
  you: <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></svg>,
};
const LABELS: Record<Tab, string> = { pets: "Pets", calendar: "Calendar", insights: "Insights", you: "You" };
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
  const dir = useRef(1);
  const [memorialSeen, setMemorialSeen] = useState<string | null>(null);
  const { session, ready, recovering } = useSession();
  const [pwDone, setPwDone] = useState(false);
  const sync = useSyncStatus();
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
  const [pinTick, setPinTick] = useState(0);
  useEffect(() => onPinChange(() => setPinTick((n) => n + 1)), []);
  useEffect(() => {
    if (!view?.habit || !data.settings.onboarded) return;
    const t0 = today();
    const progress = trackSummary(data, view.habit.id, t0);
    const slipped = progress.today === "lapse";
    const clean = progress.today === "met";
    const streak = progress.current;
    // With app lock on, the home screen widget shows nothing about today: it sits outside the PIN.
    if (vault.hasPin()) { updateWidget({ species: view.companion.species, name: view.companion.name, line: "Tap to check in", sad: false }); return; }
    const line = slipped ? "Hasn't eaten today. A good day fixes that." : clean ? `${streak} ${streak === 1 ? "day" : "days"} on track · age ${Math.round(view.age)}` : `Waiting for today's check-in · age ${Math.round(view.age)}`;
    updateWidget({ species: view.companion.species, name: view.companion.name, line, sad: slipped });
  }, [data, view, pinTick]);
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

  if (!ready) return <div className="app"><Loading /></div>;
  if (!session) return <div className="app"><Welcome /></div>;
  if (recovering && !pwDone) return <div className="app"><NewPassword onDone={() => setPwDone(true)} /></div>;
  if (!data.settings.onboarded && sync.last === null && (sync.state === "off" || sync.state === "syncing")) return <div className="app"><Restoring /></div>;
  if (!data.settings.onboarded) return <div className="app"><Suspense fallback={<Loading />}><Onboarding /></Suspense></div>;

  if (view?.dead && memorialSeen !== view.companion.id) {
    return <div className="app"><Suspense fallback={<Loading />}><Memorial view={view} onDone={() => setMemorialSeen(view.companion.id)} /></Suspense></div>;
  }

  return (
    <div className="app">
      <div className="stage">
        <AnimatePresence mode="wait" initial={false} custom={dir.current}>
          <motion.div key={tab === "pets" && track && view ? "track" : tab} className="stage-page" custom={dir.current} variants={slide} initial="enter" animate="center" exit="exit">
            <Suspense fallback={<Loading />}>
              {tab === "pets" && (track && view ? <WithTrack><Home onBack={() => { dir.current = -1; setTrack(false); }} /></WithTrack> : <Pets onOpen={() => { dir.current = 1; setTrack(true); }} />)}
              {tab === "calendar" && <WithTrack><Journey /></WithTrack>}
              {tab === "insights" && <WithTrack><Report /></WithTrack>}
              {tab === "you" && <WithTrack><Me /></WithTrack>}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </div>
      <nav className="tabbar" aria-label="Main">
        {TABS.flatMap((t, i) => {
          const button = (
            <button key={t} className="tab" data-tab={t} aria-current={tab === t ? "page" : undefined} onClick={() => go(t)}>
              <span className="tab-ico">{ICONS[t]}</span>
              <span className="tab-label">{LABELS[t]}</span>
            </button>
          );
          return i === 2 ? [
            <div key="fab" className="fab-slot">
              <motion.button className="fab" aria-label="Log or check in" aria-haspopup="dialog" disabled={!view} onClick={() => { haptic.tap(); setQuick(true); }}
                whileTap={{ scale: 0.9 }} animate={{ rotate: quick ? 45 : 0 }} transition={spring.bouncy}>{Icon.plus}</motion.button>
            </div>, button] : [button];
        })}
      </nav>
      <QuickSheet open={quick} onClose={() => setQuick(false)} onPick={() => { setQuick(false); if (tab !== "pets" || !track) { dir.current = -1; openTrack(); } }} />
    </div>
  );
}

/** Screens that show one recovery track render nothing once there is none, even mid-transition. */
function WithTrack({ children }: { children: React.ReactNode }) {
  return useActiveView()?.habit ? <>{children}</> : null;
}

function Loading() {
  return <main className="screen center-screen" aria-busy="true"><div className="shimmer-line short" /></main>;
}
