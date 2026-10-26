import { Component, type ReactNode } from "react";

/** If a screen throws, show a calm way back instead of a white page. Data is never touched. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err: unknown) { console.error("screen error", err instanceof Error ? err.message : "unknown"); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="screen center-screen">
        <h1>Something went wrong</h1>
        <p className="muted">Your pets and your logs are safe on this phone. Reloading usually fixes it.</p>
        <button className="btn" onClick={() => location.reload()}>Reload</button>
      </main>
    );
  }
}
