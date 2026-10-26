import { defineSection, tones } from "../core";

// @copy-section update.dialog
export const updateDialog = defineSection("update.dialog", { screen: "Update", title: "Update pop-up", source: "src/ui/UpdateDialog.tsx, src/copy.ts" }, {
  title: "Update available",
  sub: tones("A new version is ready whenever you are", "A new version is ready", "A new version is out. Your call"),
  now: "Download & install",
  later: "Later",
  skip: "Don't remind",
  whats_new: "What's new",
  current: "Current",
  new: "New",
  from_to: "From {from} to {to}",
  checking: "Checking the download…",
  downloading: "Downloading {n}%",
  starting: "Starting the download…",
});
// @copy-section-end update.dialog

// @copy-section update.toasts
export const updateToasts = defineSection("update.toasts", { screen: "Update", title: "Update messages", source: "src/update.ts" }, {
  permission: "Allow {app} to install updates, then tap Update again",
  mismatch: "The download didn't match its checksum, so it was discarded",
  failed: "The download didn't finish. Check your connection and try again",
});
// @copy-section-end update.toasts
