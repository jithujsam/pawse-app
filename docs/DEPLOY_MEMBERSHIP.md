# Deploying membership: what happens, in plain words

This is the plan for switching on the seven-day trial, the paywall and Dodo Payments for the real app. **Nothing here has been done yet** (the payment code is complete for Dodo's test mode; nothing is deployed). Each step that changes the live system needs the owner's go-ahead at the time it is done.

## The pieces, in plain words

| Word | What it means for Pawse |
|---|---|
| **Database** | Where every account's pets, logs, trial dates and memberships are kept, on Supabase. |
| **Database update** (a "migration") | A prepared set of instructions that adds the membership tables and rules to the database. It adds; it doesn't delete anyone's pets or logs. |
| **AI service** (an "Edge Function" called `ai`) | The small program on Supabase that writes the pet's lines and slip explanations. The new version checks each person's trial or membership before writing anything. |
| **Payment receiver** (`dodo-webhook`) | The address Dodo Payments calls to say "this person paid", "renewed" or "was refunded". It checks Dodo's secret signature first, so nobody can fake a payment. |
| **Checkout starter** (`dodo-checkout`) | What the app calls when someone taps "Choose AI". It asks Dodo for a payment page for that person. |
| **App release** | A new Pawse APK that shows the trial, the membership page and the paywall. |

## What to provide

Everything below is **test mode** first. Live mode is a separate, later decision.

**In the Dodo Payments dashboard (test mode switched on, top of the dashboard):**
1. **Two subscription products** (Products → create a product). Pricing type **Subscription** (not "One time"), **repeat every 1 year**, price in **USD**, no trial days (Pawse has its own seven-day trial), tax category **Digital products / SaaS**:
   - "Pawse Basic", **$1.00** a year.
   - "Pawse AI", **$3.00** a year.
   Copy each product id (`pdt_…`). One-time products don't work: they never create a subscription, so there's nothing to renew or cancel.
2. **An API key** (the dashboard's API keys page, under Developer). It's shown once; paste it straight into Supabase (below), nowhere else.
3. **A webhook** (the dashboard's Webhooks page, under Developer: add an endpoint) at `https://syysftnaubbpolrmicvd.supabase.co/functions/v1/dodo-webhook`, subscribed to: `subscription.active`, `subscription.renewed`, `subscription.updated`, `subscription.plan_changed`, `subscription.on_hold`, `subscription.failed`, `subscription.cancelled`, `subscription.expired`, `payment.succeeded`, `payment.failed`, `refund.succeeded`, `dispute.lost`. Copy its **signing secret** (`whsec_…`).
4. **Return address**: `app.detoxcompanion://checkout-return` (opens Pawse). If Dodo's form refuses a non-https address, use an https page you own that links to it.

**Supabase secrets** (Dashboard → Edge Functions → Secrets → Add new secret; paste values there, never in chat, code or git):

| Name | Value |
|---|---|
| `DODO_PAYMENTS_API_KEY` | the test-mode API key |
| `DODO_PAYMENTS_WEBHOOK_KEY` | the webhook's signing secret, `whsec_…` |
| `DODO_PAYMENTS_ENVIRONMENT` | `test_mode` |
| `DODO_BASIC_PRODUCT_ID` | the Basic subscription's `pdt_…` |
| `DODO_AI_PRODUCT_ID` | the AI subscription's `pdt_…` |
| `DODO_PAYMENTS_RETURN_URL` | `app.detoxcompanion://checkout-return` |

Leave `DODO_PAYMENTS_LIVE_ENABLED` unset. Without it, `live_mode` is refused even if typed.

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

**5–6. Payments (test mode).** Apply migration 0016 first (it extends `apply_payment_event`; additive, re-runnable, touches no trial, plan or recovery row):
```bash
psql "$PROD_DB_URL" -X -1 -v ON_ERROR_STOP=1 -f supabase/migrations/0016_dodo_payments.sql
```
Set the six secrets in the dashboard (table above). Then deploy the receiver without Supabase's login check (Dodo can't log in; its signature is checked instead):
```bash
supabase functions deploy dodo-webhook --project-ref syysftnaubbpolrmicvd --no-verify-jwt
```
Deploy the checkout with the login check on (the default):
```bash
supabase functions deploy dodo-checkout --project-ref syysftnaubbpolrmicvd
```
Check that the receiver refuses an unsigned request (expect 401):
```bash
curl -s -X POST https://syysftnaubbpolrmicvd.supabase.co/functions/v1/dodo-webhook -d '{}' -w ' %{http_code}\n'
```
A test app with checkout on: Actions → **Android APK** → Run workflow on this branch, build type `debug`, checkout `dodo`. It installs next to the real app and is never published.

**7. Test purchases (test mode, a dedicated test account only).** Create a new account in the debug app (for example `pawse.test+1@…`); never use one of the existing accounts. Use the successful and declining test cards listed in Dodo's test-mode documentation (test mode never charges real money). After each step, compare with the expected result; `select * from payment_events order by id desc limit 5;` shows what arrived.

| # | Do | Expect |
|---|---|---|
| 1 | Me → Membership → Choose Basic | Dodo's page shows "Pawse Basic", $1.00/year |
| 2 | Pay with the test card | Back in Pawse: "Checking your payment…", then "Payment confirmed. Your Basic membership is active." Me shows Basic; AI wording stops; past AI text still shows |
| 3 | Dodo → Webhooks → resend the last `subscription.active` | `payment_events` outcome `duplicate`; nothing changes |
| 4 | Upgrade to AI → confirm | "Upgrade requested…", then AI active; `subscription.plan_changed` applied |
| 5 | New test account → Choose AI → close the checkout | "Checkout closed. Nothing has been charged." No plan |
| 6 | Choose AI → pay with a declining card | "The payment didn't go through…" No plan |
| 7 | Open `app.detoxcompanion://checkout-return?status=active` by hand (adb or a link) without paying | "hasn't been confirmed yet…"; no plan |
| 8 | Start a checkout, kill the app, pay, reopen within two hours | The app finds the plan on launch |
| 9 | Pause the webhook endpoint in Dodo, pay, wait, re-enable | App says "not confirmed yet"; the plan appears once Dodo retries (the app shows it on the next check or launch) |
| 10 | Dodo → Subscriptions → cancel | `cancellation` recorded, `renews = false`; access stays to the end of the year |
| 11 | Dodo → Payments → refund (full) | Access ends at once; paywall says refunded; "View my history" shows everything, AI text included |
| 12 | Send a test `refund.succeeded` for an unknown payment id from Dodo's webhook page (its test sender) | `needs_review` in `payment_events_review`; nobody's access changes |
| 13 | Send a webhook with a wrong signature (curl above) | 401, nothing recorded |
| 14 | Renewal: Dodo test mode's subscription tools (or `subscription.renewed` from the dashboard's test sender) | Period extends by a year |

Before and after the tests, compare the existing accounts (read-only; must be identical):
```sql
begin transaction read only;
select count(*), md5(string_agg(user_id || '|' || started_at || '|' || ends_at || '|' || source, ';' order by user_id)) from trial_grants
  where user_id not in (select id from auth.users where email like 'pawse.test+%');
select count(*), md5(coalesce(string_agg(e::text, ';' order by user_id), '')) from entitlements e
  where user_id not in (select id from auth.users where email like 'pawse.test+%');
rollback;
```

**8. AI service**
```bash
supabase functions deploy ai --project-ref syysftnaubbpolrmicvd
```
It uses `supabase/functions/ai/deno.json` and the frozen `deno.lock`; JWT verification stays on. Then check:
- a call with no login is refused (expect 401): `curl -s -X POST https://syysftnaubbpolrmicvd.supabase.co/functions/v1/ai -d '{}' -w ' %{http_code}\n'`;
- a slip logged on a test account gets AI wording;
- the function logs show the caller's address in `x-forwarded-for`.

**9. Live mode** (a separate decision; not part of the test-mode work). Create the two products again in live mode, a live API key and a live webhook to the same address. Replace `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`, `DODO_BASIC_PRODUCT_ID` and `DODO_AI_PRODUCT_ID` with the live values, set `DODO_PAYMENTS_ENVIRONMENT=live_mode` **and** `DODO_PAYMENTS_LIVE_ENABLED=true`.

### Before accepting real payments
- Every row of the step 7 table passed in test mode on a real Android phone, and the existing accounts' check is identical before and after.
- Dodo's live business verification is complete, and the terms of sale, refund policy and support address are published (Dodo requires them).
- Decide what the owner does with `payment_events_review` rows (refunds that couldn't be matched, partial refunds) and check it regularly.
- An off-site database backup routine is running (`docs/MONETISATION.md` §8): payment history lives in the database.
- The release build is made with `VITE_CHECKOUT=dodo` (step 10) only after live checkout works.

**10. App release.** Set `VITE_CHECKOUT=dodo` in `apps/web/.env.production` and bump `apps/web/version.json`. Then Actions → **Android APK** → Run workflow → `release` on `main`, with `publish` ticked and the notes from `docs/RELEASE_NOTES_5.1.0.md`. A plain push to `main` never publishes: it only builds a test APK.

**11. Optional.**
- Authentication → Hooks → Before User Created → Postgres → `public.hook_before_user_created`.
- Authentication → Policies → leaked-password protection on.
- If `rls_auto_enable` is Supabase's documented helper, consider revoking `anon` execute on it.

### Rollback

| What | How |
|---|---|
| AI service | Deploy `backup/ai-v14` (or this repository at `54b4d81`). Immediate. |
| Payment receiver or checkout | `supabase functions delete dodo-webhook` (or `dodo-checkout`), or delete `DODO_PAYMENTS_API_KEY` (checkout answers 503) or `DODO_PAYMENTS_WEBHOOK_KEY` (receiver answers 503; Dodo retries later). Immediate. |
| Migration 0016 | Deploy the previous functions first, then `psql "$PROD_DB_URL" -X -1 -v ON_ERROR_STOP=1 -f supabase/deploy/membership/90-rollback-0016.sql`. Keeps the added columns and every payment row. |
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
