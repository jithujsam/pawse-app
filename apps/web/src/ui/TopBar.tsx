import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Controls";
import { t } from "../text";

/**
 * Android's large top app bar. The title sits large at the top of the screen; once it scrolls away, a slim sticky bar
 * (56px) carries the title instead. Back and actions appear in both.
 */
export function TopBar({ title, back, actions }: { title: string; back?: () => void; actions?: ReactNode }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [small, setSmall] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setSmall(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const backBtn = back && <button className="icon-btn topbar-back" aria-label={t("ui.common.back")} onClick={back}>{Icon.back}</button>;
  return (
    <>
      <header className="topbar-large">
        {backBtn}
        <h1 className="t-headline">{title}</h1>
        {actions && <div className="topbar-actions">{actions}</div>}
        <div ref={sentinel} className="topbar-sentinel" aria-hidden />
      </header>
      <div className="topbar-stick">
        <div className="topbar-small" data-on={small || undefined} aria-hidden={!small}>
          {back && <button className="icon-btn topbar-back" tabIndex={small ? 0 : -1} aria-label={t("ui.common.back")} onClick={back}>{Icon.back}</button>}
          <span className="topbar-title">{title}</span>
          {actions && <div className="topbar-actions">{actions}</div>}
        </div>
      </div>
    </>
  );
}
