import { useEffect, useRef } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

/**
 * One stack for the Android back button. The most recently opened layer (a sheet, a settings page)
 * closes first; with nothing open, the root handler runs (go Home, then leave the app).
 */
const stack: { current: () => void }[] = [];
let root: (() => boolean) | null = null;

export function listenForBack() {
  if (!Capacitor.isNativePlatform()) return;
  void App.addListener("backButton", () => {
    const top = stack[stack.length - 1];
    if (top) { top.current(); return; }
    if (root?.()) return;
    void App.minimizeApp();
  });
}

/** While `active`, the back button calls `close` instead of anything underneath. */
export function useBack(active: boolean, close: () => void) {
  const ref = useRef(close);
  ref.current = close;
  useEffect(() => {
    if (!active) return;
    const entry = { get current() { return ref.current; } };
    stack.push(entry);
    return () => { const i = stack.lastIndexOf(entry); if (i >= 0) stack.splice(i, 1); };
  }, [active]);
}

/** Handles back when no layer is open. Return true if it was handled. */
export function useRootBack(handler: () => boolean) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => { root = () => ref.current(); return () => { root = null; }; }, []);
}
