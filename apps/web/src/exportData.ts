import { actions } from "./store";

/**
 * Saves everything on this phone to a backup file. Always available, with or without a membership: a closed paywall
 * never keeps a person from their own data.
 */
export function downloadBackup(): void {
  const text = actions.exportJson();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = `pawse-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
