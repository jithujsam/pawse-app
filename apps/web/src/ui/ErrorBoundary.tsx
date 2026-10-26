import { Component, type ReactNode } from "react";
import { t } from "../text";

/** If a screen throws, show a calm way back instead of a white page. Data is never touched. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err: unknown) { console.error("screen error", err instanceof Error ? err.message : "unknown"); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="screen center-screen">
        <h1>{t("nav.loading.error_title")}</h1>
        <p className="muted">{t("nav.loading.error_body")}</p>
        <button className="btn" onClick={() => location.reload()}>{t("nav.loading.reload")}</button>
      </main>
    );
  }
}
