/**
 * Quick actions from the centre button. Home owns the slip sheet and the clean-day celebration,
 * so the request waits here until Home is on screen to take it.
 */
export type QuickAction = "slip" | "clean" | "urge" | "rest";

let pending: QuickAction | null = null;
const listeners = new Set<() => void>();

export function requestQuick(a: QuickAction) { pending = a; listeners.forEach((l) => l()); }

/** Returns the waiting action once, then clears it. */
export function takeQuick(): QuickAction | null { const a = pending; pending = null; return a; }

export function onQuick(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
