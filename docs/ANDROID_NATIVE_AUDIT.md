# Android native-feel audit (2026-10-26)

Scope: Pawse 3.9.6 (code 33), Capacitor 7.6.9, compile/target SDK 35, min SDK 23. Every row below was checked in the source. "Device" means it needs a real phone and has **not** been tested.

## Already in place (verified, left alone)

| Area | Where |
|---|---|
| Bundled assets, no remote site (`webDir: dist`, no `server.url`) | `apps/web/capacitor.config.json` |
| No pinch/double-tap zoom: viewport `user-scalable=no`, `touch-action`, WebView zoom off | `index.html`, `styles.css` (`html`), `MainActivity.java` |
| No stray selection or callout; inputs still select | `styles.css` (`body`, `input`) |
| Horizontal overflow: `.screen { overflow-x: hidden }`, `overscroll-behavior: none` | `styles.css` |
| Insets: `adjustMarginsForEdgeToEdge: "force"` plus `env(safe-area-inset-*)` | `capacitor.config.json`, `styles.css` |
| One Back stack (sheets, dialogs, sub-pages, then tab, then minimise) | `src/back.ts`, `Sheet.tsx`, `UpdateDialog.tsx` |
| Deep links (`app.detoxcompanion://auth-callback`, `://open/quick`) | `AndroidManifest.xml`, `src/deeplink.ts` |
| Session: Supabase `persistSession` + PKCE; data flushed on hide/pagehide | `src/supabase.ts`, `src/main.tsx` |
| Offline-first sync with retry/backoff and `online`/`offline` events | `src/sync.ts` |
| Haptics, local notifications with permission request | `src/haptics.ts`, `src/notify.ts` |
| Pet rendering: demand frame loop when off-screen, `low-power` GPU, dpr capped at 2 | `src/Pet3D.tsx` |
| Reduced motion and colour scheme respected | `App.tsx` (`MotionConfig`), `styles.css` |

## Verified problems and fixes

| # | Problem | Location | Fix (this change) |
|---|---|---|---|
| 1 | Launch splash was deliberately blank (transparent icon), so the first frames were an empty screen until the WebView painted | `res/values/styles.xml`, `drawable/splash_blank.xml` | Splash shows the paw (`ic_launcher_foreground`) on the app background (light and dark); `postSplashScreenTheme` added; `@capacitor/splash-screen` with `launchAutoHide:false`, lifted after first render or on boot failure (`native.ts`, `main.tsx`) |
| 2 | No control of status/nav bar icon colour: in-app dark/light could not follow the chosen theme | `look.ts` | `@capacitor/status-bar`; `setBarStyle` on every `applyLook` and when the OS theme flips in `system` mode |
| 3 | With `force` edge-to-edge Capacitor's WebView margins use system bars and cutout only, not the keyboard (`CapacitorWebView.edgeToEdgeHandler`), and the manifest sets no `windowSoftInputMode` | `capacitor.config.json`, `AndroidManifest.xml` | `@capacitor/keyboard` (resizes the content on Android 15 edge-to-edge); focused field scrolled into view (`native.ts`). **Device** |
| 4 | Sign-out with unsynced changes used `window.confirm`, a browser dialog | `screens/Account.tsx` | Same inline block asks again, with the existing copy and a warning haptic |
| 5 | Offline state only visible inside Account | `App.tsx` | Slim status bar above the tab bar while offline, reusing the existing offline strings |
| 6 | Update fallback navigated the app's own WebView to the APK URL (`window.location.href`) | `update.ts` | `@capacitor/browser` (Custom Tab) via `openExternal`; test updated |
| 7 | Touch targets of 40px: `.seg`, `.health-tabs .seg`, `.pw-toggle` | `styles.css` | Raised to 44px |

## Not changed, and why

- **Share:** nothing in the app shares, so `@capacitor/share` was not added.
- **Persistent bottom nav, design tokens, sheets, toasts:** already present (`.tabbar`, `Sheet`, `Toast`, one palette in `styles.css`). No restyle without a device to judge it.
- **`user-scalable=no`:** keeps the app from zooming like a page but also blocks accessibility pinch-zoom; font scaling from system settings still applies. Revisit if accessibility feedback asks for it.
- **Predictive back:** `enableOnBackInvokedCallback` not enabled; it would change how the existing JS back stack is invoked. Test on a device first.
- `main.tsx` still removes a `#launch` element that `index.html` no longer has (harmless).

## Baseline and results

- `pnpm typecheck`: passes before and after.
- `pnpm --filter web test`: 366 of 367 pass before and after. The one failure, `safety-paths.test.ts > a typed answer shows the right note under the field`, is pre-existing: `Dropdown` portals to `document.body` in a node-environment render (`ReferenceError: document is not defined`).
- `pnpm --filter web build` and `./gradlew assembleDebug`: succeed. Debug APK `app.detoxcompanion.test` 3.9.6 (33), debuggable, bundle and plugin config present.
- No device or emulator was available. Not tested: splash, insets, keyboard, back/gestures, status bar icons, login/session expiry, notifications, offline recovery, screen sizes, 3-button vs gesture navigation.

## Device test list (before any release)

Fresh install and update-over-install: splash then first screen in light and dark; status bar icons in both and after switching system theme; pinch and double-tap; open every tab and sheet with Back and with gesture back; open a field in Account, Plan and Log sheets and check it sits above the keyboard (also with display scaling and 3-button nav); sign in, kill the app, reopen; airplane mode and back; sign out with a pending change; reminder permission grant and deny; update fallback link.
