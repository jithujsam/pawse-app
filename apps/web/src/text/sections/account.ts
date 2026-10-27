import { defineSection } from "../core";

// @copy-section account.form
export const accountForm = defineSection("account.form", { screen: "Account", title: "Sign in and create account", source: "src/screens/Account.tsx" }, {
  unavailable: "Accounts aren't available in this build.",
  action_aria: "Account action",
  mode_label: "I want to",
  mode_up: "Create an account",
  mode_in: "Sign in to my account",
  email: "Email",
  password: "Password",
  show: "Show",
  hide: "Hide",
  show_aria: "Show password",
  hide_aria: "Hide password",
  submit_up: "Create account",
  submit_in: "Sign in",
  busy: "One moment…",
  forgot: "Forgot password?",
  email_first: "Type your email above first.",
  reset_sent: "If there's an account for that email, a reset link is on its way.",
  exists: "There's already an account with this email. Sign in with its password, or tap Forgot password.",
  created: "Account created",
  signed_in_toast: "Signed in",
  strength_0: "Too easy to guess",
  strength_1: "Weak",
  strength_2: "Okay",
  strength_3: "Good",
  strength_4: "Strong",
});
// @copy-section-end account.form

// @copy-section account.blockers
export const accountBlockers = defineSection("account.blockers", { screen: "Account", title: "Why the button is waiting", source: "src/authErrors.ts" }, {
  email: "Enter your email address to continue.",
  choose_password: "Choose a password to continue.",
  enter_password: "Enter your password to continue.",
  too_short: "Use at least 8 characters.",
  too_weak: "Make it stronger: 12 or more characters, or mix upper and lower case letters.",
});
// @copy-section-end account.blockers

// @copy-section account.errors
export const accountErrors = defineSection("account.errors", { screen: "Account", title: "Account error messages", source: "src/authErrors.ts" }, {
  invalid_login: "That email and password don't match. If you've forgotten it, tap Forgot password.",
  already: "There's already an account with that email. Try signing in.",
  email_rate: "Too many emails have been sent in the last hour. Try again later, or sign in if you already have an account.",
  rate: "Too many tries. Wait a minute and try again.",
  unconfirmed: "Confirm your email first: open the link we sent you on this phone.",
  network: "Couldn't reach the server. Check your connection.",
  leaked: "That password has shown up in data leaks. Pick another.",
  same_password: "Pick a password you haven't used before.",
  expired: "That link has expired. Ask for a new one and try again.",
  short: "That password is too short. Use at least 8 characters.",
  fallback: "Something went wrong. Please try again in a moment.",
});
// @copy-section-end account.errors

// @copy-section account.signed_in
export const accountSignedIn = defineSection("account.signed_in", { screen: "Account", title: "Signed in", source: "src/screens/Account.tsx" }, {
  as: "Signed in as {email}",
  sign_out: "Sign out",
  delete: "Delete account",
  sign_out_body: "Everything is kept in your account. This phone's copy is removed when you sign out, and comes back when you sign in again.",
  pending_one: "1 change hasn't backed up yet and will be lost. Sign out anyway?",
  pending_other: "{n} changes haven't backed up yet and will be lost. Sign out anyway?",
  delete_body: "This permanently deletes your account, your pets and every log, here and in the cloud. It can't be undone.",
  delete_confirm: "Delete my account for good",
  delete_password: "Your password, to confirm",
  deleted: "Your account was deleted",
});
// @copy-section-end account.signed_in

// @copy-section account.sync
export const accountSync = defineSection("account.sync", { screen: "Account", title: "Backup status", source: "src/screens/Account.tsx" }, {
  syncing: "Syncing…",
  offline_pending_one: "Offline. 1 change will sync when you're back.",
  offline_pending_other: "Offline. {n} changes will sync when you're back.",
  offline: "Offline. Everything is saved on this phone.",
  error: "Sync paused. It will retry on its own.",
  backed_up: "Backed up {time}",
  not_yet: "Not backed up yet.",
  now: "Sync now",
});
// @copy-section-end account.sync

// @copy-section account.check_email
export const accountCheckEmail = defineSection("account.check_email", { screen: "Account", title: "Check your email", source: "src/screens/Account.tsx" }, {
  title: "Check your email",
  body: "We sent a link to {email}. Open it on this phone and it brings you straight back here, signed in.",
  resend: "Resend the email",
  resent: "Sent again",
  confirmed: "I've confirmed, sign in",
});
// @copy-section-end account.check_email

// @copy-section account.new_password
export const accountNewPassword = defineSection("account.new_password", { screen: "Account", title: "Choose a new password", source: "src/screens/Account.tsx" }, {
  title: "Choose a new password",
  body: "You opened a reset link, so you're signed in. Pick a new password to finish.",
  label: "New password",
  save: "Save password",
  saving: "Saving…",
  updated: "Password updated",
});
// @copy-section-end account.new_password
