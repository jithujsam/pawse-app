# Deploying membership: what happens, in plain words

This is the plan for switching on the seven-day trial, the paywall and Dodo Payments for the real app. **Nothing here has been done yet.** Each step that changes the live system needs the owner's go-ahead at the time it is done.

## The pieces, in plain words

| Word | What it means for Pawse |
|---|---|
| **Database** | Where every account's pets, logs, trial dates and memberships are kept, on Supabase. |
| **Database update** (a "migration") | A prepared set of instructions that adds the membership tables and rules to the database. It adds; it doesn't delete anyone's pets or logs. |
| **AI service** (an "Edge Function" called `ai`) | The small program on Supabase that writes the pet's lines and slip explanations. The new version checks each person's trial or membership before writing anything. |
| **Payment receiver** (`dodo-webhook`) | The address Dodo Payments calls to say "this person paid", "renewed" or "was refunded". It checks Dodo's secret signature first, so nobody can fake a payment. |
| **Checkout starter** (`dodo-checkout`) | What the app calls when someone taps "Choose AI". It asks Dodo for a payment page for that person. |
| **App release** | A new Pawse APK that shows the trial, the membership page and the paywall. |

## What to provide (for tomorrow)

From the **Dodo Payments dashboard**, first in **test mode**, then the same again for **live mode** when it works:
1. **Two products**, both **subscriptions billed every year**: "Pawse Basic" at **$1/year** and "Pawse AI" at **$3/year**. Send their **product ids** (they start with `pdt_`).
2. **An API key** (Dodo → Developer → API keys). Keep it secret: send it privately, never in chat history that others can see, and never put it in the app.
3. **A webhook** pointing at `https://syysftnaubbpolrmicvd.supabase.co/functions/v1/dodo-webhook`, with at least these events ticked: `subscription.active`, `subscription.renewed`, `subscription.plan_changed`, `subscription.on_hold`, `subscription.failed`, `subscription.expired`, `refund.succeeded`, `dispute.lost`. Send its **signing secret** (it starts with `whsec_`).
4. **A return page**: the web address people land on after paying, for example a short page on the Pawse website saying "Payment received, go back to the app". It must exist before checkout goes live.

From **you**:
5. The **go-ahead** for each step marked ✋ below, at the time it's done.
6. Confirmation that a backup of the database may be taken and kept privately off Supabase (it holds people's recovery logs).

## What will happen, in order

Each step is safe on its own, and the order matters. ✋ means it needs your approval at the time.

| # | Step | What it does | What people notice |
|---|---|---|---|
| 1 | ✋ **Back up** | A complete copy of the database is saved and encrypted, off Supabase (the free plan keeps no backups). | Nothing |
| 2 | **Read-only check** | A script that only looks (it can't change anything) confirms the database is in the state we expect. | Nothing |
| 3 | ✋ **Database update** | Adds the sign-up limits, the new trial rule and the pet-lines cache fix. It removes the old "launch date" settings, which nothing will use any more. It changes no pets, logs or plans. | Nothing yet |
| 4 | **Read-only verification** | Confirms step 3 did exactly what it should. | Nothing |
| 5 | ✋ **Payment receiver** with test-mode secrets | Dodo can now report payments. With test mode, only test cards work. | Nothing |
| 6 | ✋ **Checkout starter**, test mode | Lets a test build start a test checkout. | Nothing (real users can't see it) |
| 7 | **Test purchase** | On a test build: buy, renew, refund, check that membership changes each time. | Only testers |
| 8 | ✋ **AI service update** | AI is now only for people in their trial or on the AI plan. | Existing users with the current app keep AI wording; their seven days start the first time they get one. After seven days, they get the app's built-in wording instead (their app has no paywall). |
| 9 | ✋ **Switch to live mode** | Steps 5 and 6 again with the live secrets and product ids. | Nothing yet |
| 10 | ✋ **App release** (new 5.1.x build with checkout on) | Everyone gets the trial screen, the Membership page and, after seven days, the paywall with working checkout. | Existing users: their seven days start when they open the new app (or started at step 8, if they used AI). New users: from sign-up. |
| 11 | Optional ✋ | Sign-up rate limit on; leaked-password protection on. | Nothing for normal users |

**Why this order:**
- **The app comes last, and only once checkout is live.** Seven days after the paywall reaches someone, they need a way to pay. Releasing the app before checkout works would lock people out, with export still available, but unable to buy.
- **The database comes first.** Everything else reads from it.
- **The AI service comes after the database and before the app.** The new app sends requests the old AI service would refuse.

## What doesn't change, ever

- **Nobody's data is deleted or changed by any step.** When a trial ends, everything is kept; export, sign-out and account deletion always work, and paying later opens everything exactly as it was.
- **One trial per account, kept on the server.** Reinstalling the app, signing out and in, or using another phone can't restart it.
- **Existing users aren't expired** because they signed up months ago: their seven days start when they first reach the updated membership.
- **Paying is the only way to get access after the trial**, and only Dodo's signed message can grant it. Nothing on the phone can.

---

## For the person running it (technical)

Commands run from this repository at the release commit on `main`. `PROD_DB_URL` is the **session pooler** connection string from Supabase → Connect (the direct host is IPv6-only on the Free plan). Never use `supabase db push`: the repository's `00NN_` migration versions don't match production's recorded timestamp versions.

**Production today** (read-only audit, 2026-11-03):
- An earlier version of 0014 is applied but not recorded in the migration history. It created 10 trial rows (`source = 'launch'`) and the launch-date table.
- Main's 0013 (the Brutal personality) is applied and unrecorded.
- The AI function is v14, which doesn't check membership.
- The live app is 5.0.20.

**1. Backup**
```bash
mkdir -p backup && supabase login && supabase link --project-ref syysftnaubbpolrmicvd
```
```bash
supabase db dump --linked --role-only -f backup/roles.sql
```
```bash
supabase db dump --linked -f backup/schema.sql
```
```bash
supabase db dump --linked --data-only --use-copy -f backup/data.sql
```
```bash
mkdir -p backup/ai-v14 && (cd backup/ai-v14 && supabase functions download ai --project-ref syysftnaubbpolrmicvd)
```
Check that the data dump includes `auth.users` (see `supabase db dump --help`). Encrypt the folder with `age` or `gpg`.

**2. Read-only check**
```bash
psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/deploy/membership/01-preflight.sql > preflight.txt
```
Stop and review if any of these hold:
- `users_without_trial` or `trials_without_user` isn't 0;
- a trigger on `auth.users` other than `on_auth_user_created_grant_trial` exists;
- the function fingerprints for `access_for`, `my_access`, `apply_payment_event` and `grant_trial` don't match `c2d3643`'s (`bb8977f2…`, `a91d4215…`, `d40365d3…`, `655ad56b…`; measured on Postgres 16).

**3. Database update** (one transaction each)
```bash
psql "$PROD_DB_URL" -X -1 -v ON_ERROR_STOP=1 -f supabase/migrations/0014_membership.sql
```
```bash
psql "$PROD_DB_URL" -X -1 -v ON_ERROR_STOP=1 -f supabase/migrations/0015_ai_cache_pet.sql
```

**4. Verify** (read-only; every "expect" must hold)
```bash
psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/deploy/membership/04-verify.sql
```

**5–6. Payment receiver and checkout starter (test mode first)**

Secrets for both:
```bash
supabase secrets set --project-ref syysftnaubbpolrmicvd DODO_WEBHOOK_SECRET='whsec_…' DODO_PRODUCT_BASIC='pdt_…' DODO_PRODUCT_AI='pdt_…'
```
Secrets for the checkout only:
```bash
supabase secrets set --project-ref syysftnaubbpolrmicvd DODO_API_KEY='…' DODO_API_BASE='https://test.dodopayments.com' DODO_RETURN_URL='https://…' DODO_CHECKOUT_ENABLED='true'
```
Deploy the receiver without Supabase's login check (Dodo can't log in; its signature is checked instead):
```bash
supabase functions deploy dodo-webhook --project-ref syysftnaubbpolrmicvd --no-verify-jwt
```
Deploy the checkout starter with the login check on (the default):
```bash
supabase functions deploy dodo-checkout --project-ref syysftnaubbpolrmicvd
```
A test app build needs `VITE_CHECKOUT=dodo` (for example in `apps/web/.env.production`) so its paywall offers checkout.

**7. Test purchase.** In Dodo test mode, with a test account: buy AI, then check `public.entitlements` and the Membership page. Then trigger a renewal, a refund and a lost dispute from Dodo's dashboard, and check each one changes the plan as described in `docs/MONETISATION.md` §7. Confirm that refunds and disputes carry `pawse_account_id` in their metadata. If they don't, they're recorded for manual review instead of ending access automatically.

**8. AI service**
```bash
supabase functions deploy ai --project-ref syysftnaubbpolrmicvd
```
It uses `supabase/functions/ai/deno.json` and the frozen `deno.lock`; JWT verification stays on. Then check:
- a call with no login is refused (expect 401): `curl -s -X POST https://syysftnaubbpolrmicvd.supabase.co/functions/v1/ai -d '{}' -w ' %{http_code}\n'`;
- a slip logged on a test account gets AI wording;
- the function logs show the caller's address in `x-forwarded-for`.

**9. Live mode.** Run the secrets from steps 5–6 again with the live values, including `DODO_API_BASE='https://live.dodopayments.com'`. Point Dodo's live webhook at the same receiver address.

**10. App release.** Set `VITE_CHECKOUT=dodo` in `apps/web/.env.production` and bump `apps/web/version.json`. Then Actions → **Android APK** → Run workflow → `release` on `main`, with `publish` ticked and the notes from `docs/RELEASE_NOTES_5.1.0.md`. A plain push to `main` never publishes: it only builds a test APK.

**11. Optional.**
- Authentication → Hooks → Before User Created → Postgres → `public.hook_before_user_created`.
- Authentication → Policies → leaked-password protection on.
- If `rls_auto_enable` is Supabase's documented helper, consider revoking `anon` execute on it.

### Rollback

| What | How |
|---|---|
| AI service | Deploy `backup/ai-v14` (or this repository at `54b4d81`). Immediate. |
| Payment receiver or checkout | `supabase functions delete dodo-webhook` (or `dodo-checkout`), or unset `DODO_CHECKOUT_ENABLED`. Immediate. |
| Database update | `psql "$PROD_DB_URL" -X -1 -v ON_ERROR_STOP=1 -f supabase/deploy/membership/90-rollback-0014.sql` restores the previous functions (including its launch-date rule). Trials already started keep their dates. No recovery data changes. 0015 needs no rollback. |
| Sign-up limit | Switch the hook off. Immediate. |
| Anything else | Restore the step 1 backup. Last resort; it causes downtime. |

Not reversible: AI text already written; trials people have already seen start.

### Migration history

Production records only 4 of 15 migrations. Recording 0013–0015 is optional (only the Supabase CLI reads that table, and it can't be used here anyway). If wanted, choose one convention and record all three together, with approval.

### Rehearsal (2026-11-03, local Postgres 16)

A copy of production's audited state was used: 0001–0012, main's 0013, 10 accounts, then the earlier 0014 with its 10 in-advance trial rows.
- `01-preflight.sql` ran read-only.
- 0014 and 0015 applied.
- `04-verify.sql`: every expectation held, with the 10 rows still waiting for their first access.
- The oldest account (registered 300 days ago) got a fresh seven days at its first access.
- A new sign-up got its trial at creation.
- Rollback restored the previous functions, and 0014 re-applied cleanly.
