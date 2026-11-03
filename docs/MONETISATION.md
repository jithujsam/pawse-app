# Membership and monetisation

How pawse charges, what is enforced where, and what is still missing before real customers can pay. Product decisions are in PRD §24; this document is the implementation. Status on 2026-11-03: **built and tested locally, not deployed, no payment provider.**

## 1. Product rules (PRD §24)

- **No free tier.** Every new account gets a **seven-day trial** from the moment it registers: every pet, breed and look, AI features, **one recovery track**.
- **Basic, $1 a year:** the whole app except AI. No new AI requests.
- **AI, $3 a year:** everything in Basic plus every AI feature, current and future.
- Both are annual, not lifetime.
- When a trial or a year ends without a purchase, the app shows a **hard paywall**: no new check-ins, slips, urges or edits, and no AI. **Nothing is deleted, archived, hidden for good or changed.** Export, sign-out, account deletion and the privacy statements stay reachable. Buying or renewing opens the app exactly as it was.

## 2. Where each rule is enforced

| Rule | Enforced by | Where |
|---|---|---|
| One trial per account, seven days from registration | Database | `trial_grants` (primary key = account; `check (ends_at = started_at + 7 days)`), trigger `on_auth_user_created_grant_trial`, lazy rebuild from `auth.users.created_at` in `access_for` (migration 0013) |
| Trial can't be restarted by reinstalling or signing in again | Database | The trial is a row keyed by the account and dated from `auth.users.created_at`. Nothing on the phone is involved |
| Nobody can grant themselves a plan | Database | `trial_grants` and `entitlements`: select-own RLS policy only; insert/update/delete revoked from `anon` and `authenticated`. `apply_payment_event`, `access_for`, `abuse_hit`: execute for `service_role` only |
| What an account may do now | Database | `access_for(uuid)` (service role) and `my_access()` (the signed-in person's own). Expiry is read against `now()`, so no scheduled job is needed |
| No new AI without the trial or the AI plan | **AI Edge Function** | `supabase/functions/ai/handler.ts`: `access_for` → `aiGate` (`access.ts`) before the cache, the quota or the provider. Basic → 403 `plan`; expired, refunded, revoked → 403 `plan`; unconfirmed trial email → 403 `verify`; lookup failure → 503 `access` (fails closed) |
| AI cost controls | AI Edge Function | Trial: 20 calls a day (`AI_TRIAL_DAILY_LIMIT`) and 200 trial calls a day per hashed network (`AI_TRIAL_NETWORK_DAILY_LIMIT`). AI plan: 80 a day (`AI_DAILY_LIMIT`). Everyone: `AI_GLOBAL_DAILY_LIMIT` (3000) |
| Paywall, no new records after expiry, one track in the trial | **App only** (UX, not security) | `apps/web/src/access.ts` (the gate), `store.ts` (`setWriteGate`, `setTrackLimit`), `App.tsx` (paywall), `screens/Paywall.tsx` |
| Recovery data is never gated | Design rule | No recovery table has a membership policy, check or trigger. `supabase/tests/membership.sql` proves a revoked account still syncs any number of tracks |

**What a modified APK can and can't do.** The app is untrusted. Someone who patches the APK can remove the paywall and keep logging on their own phone, and their rows still sync (recovery data is deliberately never gated; see §5). They **can't** get new AI output, because the AI function asks the database, not the app. They can't extend a trial or create a plan, because those rows are writable only by the service role. The paid value that costs money, AI, is the part enforced on the server. Non-AI use behind a patched APK is a known, accepted limitation.

## 3. The data model (migration 0013)

| Object | What it is |
|---|---|
| `trial_grants(user_id pk, started_at, ends_at, source)` | One per account. `source` is `signup` (trigger), `launch` (accounts that existed when 0013 ran) or `lazy` (rebuilt from `created_at` if the trigger was missing). Cascades with the account |
| `entitlements(user_id pk, plan, status, period_start, period_end, provider, provider_ref)` | The current annual plan. `plan`: `basic` or `ai`. `status`: `active`, `expired`, `refunded`, `revoked`. Cascades with the account |
| `payment_events(id, provider, event_id, user_id, kind, plan, period_*, provider_ref, outcome, received_at)` | Append-only audit. `unique (provider, event_id)` makes webhook retries no-ops. `user_id` becomes null when the account is deleted (kept for refunds and accounting, linked to no one) |
| `abuse_salts(day, salt)`, `abuse_counters(kind, ip_hash, window_start, hits)` | Rate-limit counters keyed by `sha256(daily random salt ‖ address)`. Salts and counters older than two days are deleted, after which no stored hash can be matched to an address. No raw address is ever stored |
| `access_for(uuid) → jsonb` | `{state, app, ai, email_verified, tracks, valid_until, trial_ends_at, plan, plan_status, period_end, server_time}`. `state`: `trial`, `basic`, `ai`, `expired`, `refunded`, `revoked`, `none`. Order: active paid plan, then running trial, then why access ended |
| `my_access() → jsonb` | `access_for(auth.uid())` for the signed-in person |
| `apply_payment_event(...) → text` | The only write path for plans. See §7 |
| `abuse_hit(kind, ip, window_minutes, limit) → bool` | Hashes and counts; a missing address is never refused |
| `hook_before_user_created(event) → jsonb` | Supabase Auth "Before User Created" hook: at most 10 sign-ups an hour per hashed address; past that, `429` until the next hour. **Not active until switched on in the dashboard** |

All functions are `security definer` with `set search_path = ''` and explicit grants. "Unknown or temporarily unavailable" is not a database state: it is what the app and the AI function do when `my_access`/`access_for` can't be reached (§6, §2).

**Accounts that exist before launch** get a trial starting when 0013 runs (`source = 'launch'`), not from their registration date, so nobody is locked out the moment the paywall ships. This departs from "the trial begins at registration" for existing accounts only, and it is a product decision to confirm (§11).

## 4. Trial abuse: what is and isn't prevented

- **Account-based**: one trial per account, server-owned dates, can't be restarted by reinstalling, signing out and in, clearing data, or changing the phone's clock.
- **Email**: the app's sign-up flow expects a confirmation email ("Check your email", `screens/Account.tsx`). Whether the project *requires* confirmation before sign-in is a dashboard setting (Authentication → Sign In / Providers → Confirm email) that couldn't be checked from the repository. Either way, trial **AI** requires `email_confirmed_at`, so an address that never confirms can't spend AI.
- **Network rate limits** (hashed, short-lived): 10 sign-ups an hour per network (once the hook is on) and 200 trial AI calls a day per network. These are limits, not bans: they reset on their own and never block paid accounts.
- **Not prevented**: a person creating several accounts with several real email addresses gets several trials. Account-based enforcement can't stop that, and an IP address is not a person (mobile carriers and offices share them). Deleting an account and registering again with the same email also gets a new trial, because deletion removes everything about the account; keeping a hash of deleted emails would stop it but contradicts "delete removes everything" and is left as a product decision. No device fingerprinting is used.
- Supabase Auth's own sign-up rate limits and CAPTCHA (Authentication → Rate Limits / Attack Protection) are further options. They are dashboard settings and were not changed.

## 5. Downgrade and data safety

- Expiry, refund and revocation change **only** `entitlements.status` or pass a date. No recovery row is touched, by the database or the app.
- The app's write gate (`store.ts`) stops *new local changes* only. Rows arriving from the account ("remote") and erases ("reset") always go through. Sync keeps running behind the paywall, so changes made before access ended still upload.
- No RLS policy, CHECK constraint or trigger on a recovery table mentions membership. If one did, sync would treat the refusal as permanent (`sync.ts` `isRowLevel`) and strand rows on one phone. `supabase/tests/membership.sql` asserts a revoked account still inserts and reads its rows.
- The trial's one-track limit applies only to **opening** a track (`createTrack`). A restore (`importJson`), another phone's rows, or a plan ending never remove, archive or hide a track. Unarchive and resume are never gated.
- AI text already received (slip explanations on entries, weekly summaries in `weekly_reports`) stays forever. Only new requests are refused.
- Export is on the paywall, alongside sign-out and account deletion.

## 6. Offline behaviour

- After sign-in the app reads `my_access()`, validates it with `ServerAccess` (`packages/schema/src/membership.ts`) and keeps it in IndexedDB as `access:<account id>`.
- It refreshes on start, on coming back to the foreground (at most once a minute), when the network returns, and every 30 minutes while open. That is a handful of small RPCs per person per day.
- **Offline grace: 7 days** (`OFFLINE_GRACE_MS`). A kept answer is trusted for 7 days after it was fetched and **never past the trial's or plan's own end date**, which is checked every minute, offline too, in server time (the phone's clock offset at the last check is applied).
- After 7 days without reaching the server: paywall, reason "unconfirmed" (connect and check again). Nothing is lost.
- A phone that has never had an answer and can't reach the server shows "Can't check your membership" with Retry, Export and Account. It neither lets in nor shuts out.
- A server without migration 0013 (the function is missing) means membership is off: the app gates nothing, as before.
- Switching accounts: the kept answer is per account and is wiped with the phone's copy on sign-out (`resetAll` clears IndexedDB) and on a different account signing in (`App.tsx` owner check). An answer that arrives after sign-out is dropped.
- **Limitation**: offline, a person who sets the phone's clock back can stretch the grace period on that phone. It only affects local, non-AI use, which a patched APK could unlock anyway (§2).

## 7. Payments: the provider-independent contract

**Blocked until a provider is chosen.** Nothing can be bought, and the paywall says so: it shows no buy button and claims no purchase.

- **Client boundary**: `apps/web/src/billing.ts` (`CheckoutProvider`). Today `checkout = noCheckout` (`available: false`). A provider adapter opens the provider's hosted checkout with the account's Supabase user id as its reference, then calls `refreshAccess()`. The app never grants anything from a callback or return URL.
- **Server boundary**: `supabase/functions/_shared/payments.ts`.
  - A provider adapter implements `PaymentVerifier.verify(req)`: check the signature with the provider's secret (an Edge Function secret) and map the event to a `VerifiedPaymentEvent`.
  - `processPaymentWebhook` returns 401 for an unverified request (records nothing), 400 for a malformed event, 500 for a database error (the provider retries), and 200 with the outcome otherwise.
  - `_shared` is never deployed as a function; a real webhook function is a few lines wrapping it.
- **Database**: `apply_payment_event` records the event once per `(provider, event_id)` and applies it in the same transaction, with the account row locked.

| Event | Effect |
|---|---|
| `purchase`, `renewal`, `grant` | Activates or extends the plan. An upgrade (Basic → AI) switches at once; a later period of the same plan extends; an older period arriving late is `stale`; Basic bought while AI is active is `needs_review` (the app never offers it) |
| `payment_failed` | `recorded`; access continues to the end of the paid period |
| `expiry` | Ends the current period. An expiry for a period that has since been renewed is `stale` |
| `refund`, `revocation` | Ends access at once. If `provider_ref` names a purchase that has since been replaced, it's `stale` |
| Any event seen before | `duplicate`, nothing changes |
| Unknown or deleted account | `no_account`, kept anonymously |

**What a provider integration must still decide and build**: provider choice (Play Billing doesn't apply to a sideloaded APK; a web checkout from the app needs to be checked against the provider's and Google's rules and against tax obligations), the adapter and its signature check, the webhook function and its secret, mapping provider products to `basic`/`ai`, and how refunds reference purchases. A manual `grant` (support, testing) can be applied today with `select apply_payment_event('manual', '<unique id>', '<user id>', 'grant', 'ai', now(), now() + interval '1 year', null);` as the service role.

## 8. Supabase Free plan

Nothing here needs a paid Supabase plan. One existing Edge Function was extended and none were added; there are no scheduled jobs and no Realtime.

| Free plan fact (Supabase docs, checked 2026-11-03) | What it means for pawse |
|---|---|
| Edge Function invocations: 500,000 a month | Each AI request is one invocation. Membership adds none: the app reads `my_access` through the REST API, not a function |
| Projects with low activity for 7 days are paused; restorable for 90 days | A paused project means no sync, no AI and no membership checks. Phones keep working offline for up to 7 days of grace, then show "unconfirmed". With paying customers this risk needs an upgrade or reliable daily activity |
| No automatic backups on Free (Pro has daily backups) | Payment records and plans would be lost with the database. See the backup procedure below |
| Database size, egress and monthly active users are capped (see the pricing page for the current numbers) | The new tables are small: one row per account (trial, plan), one per payment event, and abuse counters that delete themselves after two days |
| Auth hooks are listed as beta | `hook_before_user_created` may change shape; re-check before relying on it. Whether the hook is available on the Free plan wasn't verified |

### Off-site backup and recovery (before accepting real customers)

1. Install the Supabase CLI on a trusted computer, and link it to the project (`supabase login`, `supabase link --project-ref <ref>`).
2. At least daily, run all three dumps:
   - `supabase db dump -f roles.sql --role-only`
   - `supabase db dump -f schema.sql`
   - `supabase db dump -f data.sql --use-copy --data-only`
3. Make sure the `auth` schema's data is included (accounts and their creation times are what trials are dated from). Check the current flags with `supabase db dump --help`; the CLI's defaults have changed between versions.
4. Encrypt the files (they contain personal recovery data), e.g. `age` or `gpg`. Keep them in at least one place outside Supabase. Keep 30 days, and test a restore into a scratch project once a month.
5. **Restore**: create a project, then `psql` roles, schema, auth data and data in that order. Redeploy the `ai` function and its secrets, and point the app at the new project only if the URL changes.
6. Payment events also live at the provider. After a restore, replay the provider's events since the backup through the webhook; `(provider, event_id)` idempotency makes the replay safe.

## 9. Deploying (none of this has been done)

1. Confirm the open decisions in §11.
2. Take a backup (§8).
3. Check which migrations production already has (Dashboard → Database → Migrations, or `supabase migration list`), and apply any missing ones up to 0012.
4. Apply `0013_membership.sql`. First run it on a disposable database with `supabase/tests/membership.sql`.
5. Check: `select count(*) from trial_grants` equals `select count(*) from auth.users`.
6. Deploy the `ai` function **after** 0013 (it calls `access_for`; before 0013 it refuses every AI call with `access`). Optional secrets: `AI_TRIAL_DAILY_LIMIT`, `AI_TRIAL_NETWORK_DAILY_LIMIT`.
7. Optionally switch on the sign-up hook: Authentication → Hooks → Before User Created → Postgres → `public.hook_before_user_created`.
8. Release an app version with the paywall, by docs/RELEASING.md. Older app versions keep working without a paywall (they don't call `my_access`); their AI requests are enforced by the function all the same.
9. Before taking money: choose a provider, build its adapter and webhook function, and test it in the provider's test mode end to end.

**Rollback**: redeploy the previous `ai` function to stop enforcing AI by plan. The 0013 tables can stay; an app version without `my_access` ignores them. To stop the paywall in the app, ship an app build where `startAccess` isn't called, or drop `my_access()` (the app treats a missing function as membership off).

## 10. Tests

| What | Where |
|---|---|
| Trial grant, uniqueness, 7-day check, registration-dated, lazy rebuild; RLS and privileges; every access state; payment transitions, duplicates, stale and out-of-order events, refunds, revocation, renewal after expiry, unknown accounts, account deletion; abuse counters and the hook; recovery rows never gated | `supabase/tests/membership.sql` (67 checks) |
| AI function called directly: no token, forged token, each state, unconfirmed email, lookup failure, cache not bypassing membership, trial and plan limits, network limit, global switch | `apps/web/test/ai-function.test.ts` |
| The app's gate: states, offline grace, clock offset, end dates offline, account switching, late answers, malformed answers, missing function, renewal; the store refusing new records but keeping everything; export after expiry; AI text kept; remote rows still applied; trial's one track; restore keeping every track; sync uploading behind the paywall | `apps/web/test/membership.test.ts` |
| Paywall wording in every Voice, no buy button without a provider, export and account controls present | `apps/web/test/paywall.test.tsx` |
| Webhook contract: signature, provider mismatch, duplicates, malformed events, database failures, no provider | `apps/web/test/payments.test.ts` |
| Access answer schema | `packages/schema/test/membership.test.ts` |

## 11. Decisions that need the product owner

1. Existing accounts get 7 days from launch rather than from registration (§3).
2. Re-registering after deleting an account gets a new trial (§4).
3. The offline grace period: 7 days (§6).
4. Trial AI limits: 20 calls a day per account, 200 a day per network (§2).
5. Basic bought while AI is active is held for review rather than queued (§7).
6. A refund during the trial ends the plan but not the remaining trial days (the trial belongs to the account).
7. "One pet" in the trial is read as one recovery track and its pet; adopting again after a pet's death (classic rules) stays allowed.
8. The paywall heading uses the product name as the brand writes it ("pawse — Your commitment to change."), not "PAWSE".
9. Payment provider, prices in other currencies, taxes, and terms of sale.
