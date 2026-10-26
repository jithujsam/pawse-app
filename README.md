<p align="center"><img src="apps/web/public/icon-192.png" width="96" height="96" alt="pawse logo"></p>

<h1 align="center">pawse</h1>
<p align="center"><b>Pause the habit. Keep your pet happy.</b></p>

pawse is a habit-change app with a pet at its heart. Pick something you want to change, such as late-night food orders, impulse buys, smoking or doomscrolling, set your own goal (stop, cut down, or understand it first), and adopt a companion. Days with your goal met help them heal, slips cost a little, and the app helps you get through urges and learn from slips. A slip is information, not a verdict.

It's built to feel warm rather than preachy. It's honest about slips, generous about progress, and careful with your data.

<p align="center">
  <img src="docs/screenshots/light-00-pets.png" width="230" alt="Pets: a 3D dog, fox and voxel cat, one per habit">
  <img src="docs/screenshots/light-04-home.png" width="230" alt="Home: the 3D pet, health buttons and today's check-in">
  <img src="docs/screenshots/light-05-health.png" width="230" alt="Health: a heart that fills to the pet's health">
</p>

## What it does

**A pet that reflects how things are going**
- Three pets, all in 3D: a **3D dog** with a face that shows how it feels, a **blocky voxel cat** and a **3D fox**, each with several coats and one of four personalities (playful, calm, sassy, wise). The 2D drawings remain only as a fallback for phones that can't run 3D. The rabbit, owl and panda are switched off for now; pets that already are one stay as they are.
- Personality changes how the pet plays and talks, and you choose how direct it is: Gentle, Honest or Direct.
- Tap the pet to pet it, tickle it or stroke it, and it reacts.

**Health you can understand**
- **Health:** a heart from 0 to 100 with a plain-language summary that praises good care and is straight about slips.
- **History:** the pet's life story, for example "Biscuit lost 3 months of lifespan" or "5 clean days, 6 months of life back".
- **Conditions:** pet ailments that mirror the habit, each with why it happened and how many clean days fix it. A dog gets kennel cough, a cat feline asthma, a rabbit gut slowdown.
- **You & pet:** days together, clean days, best streak, life lost and healed, urges ridden out, check-in rate.

**Fair rules** (all in `packages/engine`, all tested)
- A slip costs a few months of life. More slips in one day cost more.
- A clean day heals 1.5 months. Some damage always stays, so history matters.
- **Hidden reserve:** about two clean months build a cushion, so a one-off slip after a long run doesn't hurt.
- **Binge scar:** three or more slips in one day lower the pet's life expectancy for good.
- **Quiet days:** the pet only heals on days you check in. A quiet day is missing data, not a slip, so it costs nothing; gentle reminders follow. (The engine still has the older "loneliness" rule, switched off by `QUIET_DAYS_AGE` in `src/store.ts`.)
- **The way back:** after every slip you see exactly how many clean days undo it.

**Recovery tools (3.0)**
- **Your plan:** goal, reasons, hard situations, a first step, strategies you prefer and if-then plans. All optional, all editable.
- **Five day states:** goal met, slip, urge managed, not tracking (your choice) and not recorded. A day you don't record is unknown, never a failure or a success.
- **Urge support:** pause and notice, name it, change where you are, add friction, breathe, do something else, reach out. Switch any time; no promise that it ends by a set time.
- **After a slip:** calm words, what you've built still stands, and an optional reflection with one thing to try next time.
- **Weekly review:** progress toward your goal, urges managed, what helped, what was hard, and one adjustment for next week.
- **Humane pet rules:** by default your companion can get very frail but never dies, and everything can heal back. Classic rules (death, permanent scars) are opt-in.

**Tools that help in the moment**
- **Insights:** this week against last, urges ridden out, a map of your risky hours, money kept and a savings goal.
- **Journey:** milestones, streaks, a calendar where you can fill in or correct today and the three days before it, and a one-line daily reflection.
- **Notes from your pet:** a thank-you after clean days, a heads-up before your usual risky hour, and a check-in reminder.
- **Two Android home-screen widgets** (one on a card, one clear on the wallpaper) stack all your pets, each breathing in its mood today. Tap one to check in.

<p align="center">
  <img src="docs/screenshots/light-07-conditions.png" width="190" alt="Conditions with recovery days">
  <img src="docs/screenshots/light-10-urge.png" width="190" alt="Urge SOS breathing">
  <img src="docs/screenshots/light-11-insights.png" width="190" alt="Insights">
  <img src="docs/screenshots/light-13-journey.png" width="190" alt="Journey">
</p>

<p align="center">
  <img src="docs/screenshots/light-01-welcome.png" width="160" alt="Welcome">
  <img src="docs/screenshots/light-02-species.png" width="160" alt="Choose your companion">
  <img src="docs/screenshots/light-06-history.png" width="160" alt="History: the pet's life story">
  <img src="docs/screenshots/light-09-quick.png" width="160" alt="Quick check-in">
  <img src="docs/screenshots/light-14-me.png" width="160" alt="Settings">
</p>

<p align="center"><b>Dark mode</b><br>
  <img src="docs/screenshots/dark-00-pets.png" width="190" alt="Pets in dark mode">
  <img src="docs/screenshots/dark-04-home.png" width="190" alt="Home in dark mode">
  <img src="docs/screenshots/dark-05-health.png" width="190" alt="Health in dark mode">
  <img src="docs/screenshots/dark-11-insights.png" width="190" alt="Insights in dark mode">
  <img src="docs/screenshots/dark-13-journey.png" width="190" alt="Journey in dark mode">
</p>

## Privacy and safety

- An account is needed so your pet survives a lost phone. Your data is protected by row-level security, so only you can read it. Photos never leave the phone.
- An optional PIN encrypts everything stored on the phone (PBKDF2 with AES-GCM).
- When you log a slip, its details go through a server function to an AI model that writes a short explanation. No AI key ships in the app, and every AI answer is checked and falls back to plain text if anything is off.
- It never tracks calories, weight or restriction. It's a self-awareness tool, not medical advice. Pet conditions are illustrative.
- Your region comes from the phone's time zone, which sets the currency and clock with no location permission. Times always show on a 12-hour clock.

## How it's built

| Part | What it is |
|---|---|
| `apps/web` | React 19 + TypeScript on Vite, wrapped for Android with Capacitor 7 |
| `packages/engine` | The pure ageing maths: deductions, healing, scars, reserve, quiet days |
| `packages/schema` | Zod schemas for everything stored, synced or sent to the AI |
| `supabase` | Postgres tables with row-level security, plus the `ai` edge function (OpenRouter) |
| Animation | `motion` for UI; three.js + React Three Fiber for the 3D pets |

### Open-source pieces and licences

| Dependency | Licence |
|---|---|
| three.js 0.186 | MIT |
| @react-three/fiber 9.8 | MIT |
| motion 12 | MIT |
| React 19, Capacitor 7, Supabase JS, Zod | MIT |
| Geist, Newsreader fonts | SIL Open Font License |

### 3D models

| File | Model | Author | Licence |
|---|---|---|---|
| `public/models/dog.glb` | Shiba Inu | Quaternius | CC0 1.0 |
| `public/models/fox.glb` | Fox | Quaternius | CC0 1.0 |
| `public/models/cat.glb` | Cat (blocky voxel) | Quaternius | CC0 1.0 |

Sources and notes are in [`apps/web/public/models/LICENSE.md`](apps/web/public/models/LICENSE.md). The models are rigged with skeletal animation clips (idle, head-low idle, hit react, jump, death). The dog also has a face rig (eyelids, brows, tongue); the cat and fox show their mood through body animation and posture. Accessories are 2D-only.

## Develop

    pnpm install
    pnpm dev          # the app at http://localhost:5173
    pnpm test         # engine, schema and app tests
    pnpm typecheck
    pnpm simulate     # 90-day age curves for light, medium and heavy patterns

Read [`docs/PRD.md`](docs/PRD.md) first: it is the source of truth for the product and the engine rules.

### Android release APK

    # 1. Bump apps/web/version.json (the code must go up every release)
    # 2. Put the signing key in apps/web/android/keystore/ (not in git; see the README there)
    pnpm --filter web build
    cd apps/web && npx cap sync android
    cd android && ANDROID_HOME=/path/to/sdk ./gradlew assembleRelease
    # -> apps/web/android/app/build/outputs/apk/release/app-release.apk

Requires Java 21 and Android SDK 35.

### Database

Run the migrations in `supabase/migrations` in order (0001 to 0005). Each one is additive and safe to re-run. See `supabase/README.md` for the AI function and its secret.

### Where things live

- `src/Pet3D.tsx`: the 3D pets. `src/Companion.tsx`: live behaviour, and the 2D art used where 3D can't run.
- `src/health.ts`: the health report, conditions, history and stats. `src/voice.ts`: everything the pet says.
- `src/store.ts`: state, IndexedDB persistence, encryption. `src/sync.ts` and `src/syncmap.ts`: offline-first sync.
- `src/notify.ts`: reminders and pet notes. `src/region.ts`: time zone and currency.
