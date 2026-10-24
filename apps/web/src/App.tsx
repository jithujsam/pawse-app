import { useState } from "react";
import { activeCompanion, useData, viewCompanion } from "./store";
import { Onboarding } from "./screens/Onboarding";
import { Home } from "./screens/Home";
import { CalendarScreen } from "./screens/Calendar";
import { Report } from "./screens/Report";
import { You } from "./screens/You";
import { Memorial } from "./screens/Memorial";

type Tab = "home" | "calendar" | "report" | "you";

const ICONS: Record<Tab, JSX.Element> = {
  home: <svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>,
  calendar: <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>,
  report: <svg viewBox="0 0 24 24"><path d="M5 20V10M12 20V4M19 20v-7" /></svg>,
  you: <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></svg>,
};
const LABELS: Record<Tab, string> = { home: "Home", calendar: "Calendar", report: "Report", you: "You" };

export function App() {
  const data = useData();
  const [tab, setTab] = useState<Tab>("home");
  const [memorialSeen, setMemorialSeen] = useState<string | null>(null);

  if (!data.settings.onboarded) return <div className="app"><Onboarding /></div>;

  const companion = activeCompanion(data);
  const view = companion ? viewCompanion(data, companion.id) : undefined;
  if (view?.dead && memorialSeen !== view.companion.id) {
    return <div className="app"><Memorial view={view} onDone={() => setMemorialSeen(view.companion.id)} /></div>;
  }

  return (
    <div className="app">
      {tab === "home" && <Home />}
      {tab === "calendar" && <CalendarScreen />}
      {tab === "report" && <Report />}
      {tab === "you" && <You />}
      <nav className="tabbar" aria-label="Main">
        {(Object.keys(LABELS) as Tab[]).map((t) => (
          <button key={t} className="tab" aria-current={tab === t ? "page" : undefined} onClick={() => setTab(t)}>
            {ICONS[t]}<span>{LABELS[t]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
