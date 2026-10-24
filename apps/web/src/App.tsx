import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { startSync } from "./sync";
import { useSession } from "./supabase";
import { useActiveView, useData, vault, type Boot } from "./store";
import { LockScreen } from "./screens/Lock";
import type { Sealed } from "./vault";
import { haptic } from "./haptics";
import { slide, spring } from "./motion";
import { Onboarding } from "./screens/Onboarding";
import { Home } from "./screens/Home";
import { CalendarScreen } from "./screens/Calendar";
import { Report } from "./screens/Report";
import { You } from "./screens/You";
import { Memorial } from "./screens/Memorial";
import { ToastHost } from "./ui/Toast";
import { ErrorBoundary } from "./ui/ErrorBoundary";

type Tab = "home" | "calendar" | "report" | "you";
const TABS: Tab[] = ["home", "calendar", "report", "you"];

const ICONS: Record<Tab, JSX.Element> = {
  home: <svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>,
  calendar: <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>,
  report: <svg viewBox="0 0 24 24"><path d="M5 20V10M12 20V4M19 20v-7" /></svg>,
  you: <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></svg>,
};
const LABELS: Record<Tab, string> = { home: "Home", calendar: "Calendar", report: "Report", you: "You" };

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
  const dir = useRef(1);
  const [memorialSeen, setMemorialSeen] = useState<string | null>(null);
  const { session } = useSession();
  useEffect(() => { document.documentElement.dataset.tint = data.settings.tint ?? "ocean"; }, [data.settings.tint]);
  const uid = session?.user.id;
  useEffect(() => { if (uid) void startSync(uid); }, [uid]);

  const go = (t: Tab) => {
    if (t === tab) return;
    dir.current = TABS.indexOf(t) > TABS.indexOf(tab) ? 1 : -1;
    haptic.select();
    setTab(t);
  };

  if (!data.settings.onboarded) return <div className="app"><Onboarding /></div>;

  if (view?.dead && memorialSeen !== view.companion.id) {
    return <div className="app"><Memorial view={view} onDone={() => setMemorialSeen(view.companion.id)} /></div>;
  }

  return (
    <div className="app">
      <div className="stage">
        <AnimatePresence mode="wait" initial={false} custom={dir.current}>
          <motion.div key={tab} className="stage-page" custom={dir.current} variants={slide} initial="enter" animate="center" exit="exit">
            {tab === "home" && <Home onNavigate={go} />}
            {tab === "calendar" && <CalendarScreen />}
            {tab === "report" && <Report />}
            {tab === "you" && <You />}
          </motion.div>
        </AnimatePresence>
      </div>
      <nav className="tabbar" aria-label="Main">
        {TABS.map((t) => (
          <button key={t} className="tab" data-tab={t} aria-current={tab === t ? "page" : undefined} onClick={() => go(t)}>
            {tab === t && <motion.span layoutId="tab-pill" className="tab-pill" transition={spring.snappy} />}
            <motion.span className="tab-ico" animate={tab === t ? { y: -2, scale: 1.1 } : { y: 0, scale: 1 }} transition={spring.bouncy}>{ICONS[t]}</motion.span>
            <span className="tab-label">{LABELS[t]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
