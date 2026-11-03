# Pawse 5.1.0 (code 81): release notes

**Status: prepared, not published.** Publish only as step 10 of `docs/DEPLOY_MEMBERSHIP.md`, once the database update, the payment receiver, checkout (live) and the new AI service are in place. The build that ships must be made from `main` with checkout switched on (`VITE_CHECKOUT=dodo`); the candidate below was made before that and is not the one to publish.

## For the update popup (`release_notes`, one line)

```
New: a Brutal personality, pets that talk in their own voice, and your free trial and membership options under Me → Membership.
```

## What's new, for people

- **Brutal**, a fifth personality: a sarcastic diva that roasts the habit and itself, never you.
- **Your pet talks in character.** Once a day, your pet's lines on Home and in reminders are written in its personality (when AI is included). Coming back after a few quiet days, it's theatrical about the wait, never hurt, and today still counts.
- **Membership.** Every account has a seven-day free trial with everything included. For accounts made before this update, the seven days start when you first open it. After it, an annual membership keeps the app open: **Basic, $1 a year** (everything except AI) or **AI, $3 a year** (everything, including AI), paid securely through Dodo Payments. Me → Membership shows your trial, when it ends, and both plans.
- **Adding another pet asks for a goal**, the same way as when you started (you can skip it).
- **Your data stays yours.** If access ends, nothing is deleted or changed. Export and account deletion always stay available, and buying later opens everything exactly as it was.

## What changed underneath (for the release record)

- App: membership gate (`src/access.ts`), paywall and membership page (`src/screens/Paywall.tsx`), one recovery track during the trial, AI requests only when AI is included (text already written always stays).
- AI function: membership checked on the server before the cache for every request kind (slip, pet, weekly); the pet lines and personality from 5.0.x main merged in.
- Database: `0014_membership.sql`, `0015_ai_cache_pet.sql` (production deployment is separate; see the runbook).
- Built from branch `claude/eloquent-ritchie-rmjm3q`.

## Earlier release candidate (built and verified, not published; superseded)

| | |
|---|---|
| CI run | https://github.com/jithujsam/pawse-app/actions/runs/41664461105 (`build_type=release`, `publish=false`; the publish job was skipped) |
| Artifact | `Pawse-5.1.0-81-release-5489065` (APK + `BUILD-INFO.txt`), kept 30 days |
| Commit | `548906581ed9da5048e6c46f922236e789da11fc` |
| Package | `app.detoxcompanion`, versionCode 81, versionName 5.1.0; web bundle inside reports 5.1.0 / 81 |
| Signature | v1 + v2 verified; certificate SHA-256 `10ab3feb74724e2e38161c8027e679438a89d3521525980fbbd796ad62faa9f8` (the release key) |
| Debuggable | no |
| APK SHA-256 | `464f905442eedf95e83c28741ee00f30e48a270c16f97d9fcb87823be6713da0` (7,721,848 bytes) |
| Tests in CI | schema 28, engine 59, web 567 passed; Android unit tests passed |

This candidate is still valid as a signed, verified build of that commit, but it is **not** the one to publish: it lacks the merged goal step for new pets, it has no checkout (built before Dodo was prepared), and the publish job only runs on `main`. At step 10, build from `main` with `VITE_CHECKOUT=dodo`; check the new `BUILD-INFO.txt` the same way. Its SHA-256 will differ.

## Compatibility

| Phone | Server | Result |
|---|---|---|
| 5.0.20 | new AI service | Works. The account's seven days start with its first AI request; AI wording continues during them (confirmed email), then the built-in wording, silently. |
| 5.1.x | old AI service (v14) | Works, but without AI wording or pet lines (v14 refuses the new request fields). Don't release before step 8. |
| 5.1.x | checkout not live | After seven days people meet a paywall with no way to buy (their data stays). Don't release before step 9. |
| 5.1.x | everything deployed | Full experience. |
