import { defineSection } from "../core";

// @copy-section security.lock
export const securityLock = defineSection("security.lock", { screen: "App lock", title: "App lock settings", source: "src/screens/Security.tsx" }, {
  title: "Privacy and lock",
  switch: "App lock",
  on_hint: "PIN on. Everything on this phone is encrypted.",
  off_hint: "Ask for a PIN when the app opens",
  again: "Lock again after",
  auto_aria: "Auto-lock",
  immediately: "Right away",
  one_minute: "After 1 minute",
  five_minutes: "After 5 minutes",
  change: "Change PIN",
  sheet_off: "Turn off app lock",
  sheet_set: "Set a PIN",
  is_on: "App lock is on",
  is_off: "App lock is off",
  current: "Enter your current PIN",
  current_label: "Current PIN",
});
// @copy-section-end security.lock

// @copy-section security.pin
export const securityPin = defineSection("security.pin", { screen: "App lock", title: "Choose a PIN", source: "src/screens/Security.tsx" }, {
  choose: "Choose a PIN",
  again: "Enter it again",
  length: "PIN length",
  four: "4 digits",
  six: "6 digits",
  no_recovery: "There's no way to recover it, so pick one you'll remember.",
  encrypting: "Encrypting your data…",
  mismatch: "Those didn't match. Start again.",
  weak: "That one is easy to guess. Try something less obvious.",
  new_label: "New PIN",
});
// @copy-section-end security.pin

// @copy-section lock.screen
export const lockScreen = defineSection("lock.screen", { screen: "Lock screen", title: "Lock screen", source: "src/screens/Lock.tsx" }, {
  title: "Welcome back",
  enter: "Enter your PIN",
  checking: "Checking…",
  wrong: "Wrong PIN. Try again.",
  wait: "Too many tries. Wait {n}s.",
  label: "PIN",
  forgot: "Forgot PIN?",
  forgot_body: "The PIN can't be recovered, because your data is encrypted with it. You can erase this phone's copy and start again. If you had an account, signing in brings your history back.",
  erase: "Erase and start over",
});
// @copy-section-end lock.screen
