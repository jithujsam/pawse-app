import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { startSync, useSyncStatus } from "./sync";
import { kv } from "./db";
import { Restoring, Welcome } from "./screens/Welcome";
import { NewPassword } from "./screens/Account";
import { onReminderTap } from "./notify";
import { useSession } from "./supabase";
import { actions, cleanStreak, useActiveView, useData, vault, type Boot } from "./store";
import { LockScreen } from "./screens/Lock";
import type { Sealed } from "./vault";
import { haptic } from "./haptics";
import { slide, spring } from "./motion";
import { Home } from "./screens/Home";

// Only Home ships in the first bundle; the rest load on first visit.
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

export type Tab = "home" | "insights" | "journey" | "me";
const TABS: Tab[] = ["home", "insights", "journey", "me"];

const ICONS: Record<Tab, React.JSX.Element> = {
  home: <svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>,
  insights: <svg viewBox="0 0 24 24"><path d="M5 20V10M12 20V4M19 20v-7" /></svg>,
  journey: <svg viewBox="0 0 24 24"><path d="M4 19c3 0 3-5 6-5s3 4 6 4 2-9 4-11" /><circle cx="20" cy="6" r="1.6" /></svg>,
  me: <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></svg>,
};
const LABELS: Record<Tab, string> = { home: "Home", insights: "Insights", journey: "Journey", me: "Me" };
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

function Shell() {
  const data = useData();
  const view = useActiveView();
  const [tab, setTab] = useState<Tab>("home");
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

  useEffect(() => onReminderTap(() => { dir.current = -1; setTab("home"); }), []);
  // The home screen widget opens straight into the quick check-in.
  useEffect(() => { const open = () => { setTab("home"); setQuick(true); }; window.addEventListener(OPEN_QUICK, open); return () => window.removeEventListener(OPEN_QUICK, open); }, []);
  useEffect(() => {
    if (!view?.habit || !data.settings.onboarded) return;
    const t0 = today();
    const slipped = data.entries.some((e) => e.habitId === view.habit!.id && e.day === t0);
    const clean = data.cleanDays.some((c) => c.habitId === view.habit!.id && c.day === t0);
    const streak = cleanStreak(data, view.habit.id);
    const line = slipped ? "Hasn't eaten today. A clean day fixes that." : clean ? `${streak} ${streak === 1 ? "day" : "days"} clean · age ${Math.round(view.age)}` : `Waiting for today's check-in · age ${Math.round(view.age)}`;
    updateWidget({ species: view.companion.species, name: view.companion.name, line, sad: slipped });
  }, [data, view]);
  useRootBack(() => { if (tab === "home") return false; dir.current = -1; setTab("home"); return true; });

  const go = (t: Tab) => {
    if (t === tab) return;
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
          <motion.div key={tab} className="stage-page" custom={dir.current} variants={slide} initial="enter" animate="center" exit="exit">
            <Suspense fallback={<Loading />}>
              {tab === "home" && <Home onNavigate={go} />}
              {tab === "insights" && <Report />}
              {tab === "journey" && <Journey />}
              {tab === "me" && <Me />}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </div>
      <nav className="tabbar" aria-label="Main">
        {TABS.flatMap((t, i) => {
          const button = (
            <button key={t} className="tab" data-tab={t} aria-current={tab === t ? "page" : undefined} onClick={() => go(t)}>
              {tab === t && <motion.span layoutId="tab-pill" className="tab-pill" transition={spring.snappy} />}
              <motion.span className="tab-ico" animate={tab === t ? { y: -2, scale: 1.1 } : { y: 0, scale: 1 }} transition={spring.bouncy}>{ICONS[t]}</motion.span>
              <span className="tab-label">{LABELS[t]}</span>
            </button>
          );
          return i === 2 ? [
            <div key="fab" className="fab-slot">
              <motion.button className="fab" aria-label="Log or check in" aria-haspopup="dialog" onClick={() => { haptic.tap(); setQuick(true); }}
                whileTap={{ scale: 0.9 }} animate={{ rotate: quick ? 45 : 0 }} transition={spring.bouncy}>{Icon.plus}</motion.button>
            </div>, button] : [button];
        })}
      </nav>
      <QuickSheet open={quick} onClose={() => setQuick(false)} onPick={() => { setQuick(false); if (tab !== "home") { dir.current = -1; setTab("home"); } }} />
    </div>
  );
}

function Loading() {
  return <main className="screen center-screen" aria-busy="true"><div className="shimmer-line short" /></main>;
}
