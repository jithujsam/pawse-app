# Pawse 5.1.0 (code 81): release notes

**Status: prepared, not published.** Publish only after production steps 3–6 in `docs/DEPLOY_MEMBERSHIP.md` are done and verified (the app reads membership from the server and needs the new AI function for its pet lines).

## For the update popup (`release_notes`, one line)

```
New: a Brutal personality, pets that talk in their own voice, and your free trial and membership options under Me → Membership.
```

## What's new, for people

- **Brutal**, a fifth personality: a sarcastic diva that roasts the habit and itself, never you.
- **Your pet talks in character.** Once a day, your pet's lines on Home and in reminders are written in its personality (when AI is included). Coming back after a few quiet days, it's theatrical about the wait, never hurt, and today still counts.
- **Membership.** Every account has a seven-day free trial with everything included. After it, an annual membership keeps the app open: **Basic, $1 a year** (everything except AI) or **AI, $3 a year** (everything, including AI). Me → Membership shows your trial, when it ends, and both plans. Membership can't be bought in this version yet.
- **Your data stays yours.** If access ends, nothing is deleted or changed. Export and account deletion always stay available, and buying later opens everything exactly as it was.

## What changed underneath (for the release record)

- App: membership gate (`src/access.ts`), paywall and membership page (`src/screens/Paywall.tsx`), one recovery track during the trial, AI requests only when AI is included (text already written always stays).
- AI function: membership checked on the server before the cache for every request kind (slip, pet, weekly); the pet lines and personality from 5.0.x main merged in.
- Database: `0014_membership.sql`, `0015_ai_cache_pet.sql` (production deployment is separate; see the runbook).
- Built from branch `claude/eloquent-ritchie-rmjm3q`; the exact commit and the CI run's `BUILD-INFO.txt` (SHA-256, certificate) go into the published record.

## Compatibility

| Phone | Server | Result |
|---|---|---|
| 5.0.20 | new AI function | Works. AI wording continues during the trial (confirmed email); after it, the built-in wording, silently. |
| 5.1.0 | old AI function (v14) | Works, but without AI wording or pet lines (v14 refuses the new request fields). Don't release before step 6. |
| 5.1.0 | database before step 4 | Enforces whatever trial dates are stored. Don't release before step 4. |
| 5.1.0 | everything deployed | Full experience. |
