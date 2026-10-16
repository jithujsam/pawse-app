"use client";

import { useEffect, useState } from "react";

/** True after the first client render. Exposed as data-ready so tests can wait for interactivity. */
export function useHydrated() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}
