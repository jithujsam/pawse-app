# Membership and monetisation

How pawse charges, what is enforced where, and what is still missing before real customers can pay. Product decisions are in PRD §25; this document is the implementation. Status on 2026-11-03: **built and tested locally, not deployed, no payment provider.**

## 1. Product rules (PRD §25)

- **No free tier.** Every new account gets a **seven-day trial** from the moment it registers: every pet, breed and look, AI features, **one recovery track**.
- **Basic, $1 a year:** the whole app except AI. No new AI requests.
- **AI, $3 a year:** everything in Basic plus every AI feature, current and future.
- Both are annual, not lifetime.
- When a trial or a year ends without a purchase, the app shows a **hard paywall**: no new check-ins, slips, urges or edits, and no AI. **Nothing is deleted, archived, hidden for good or changed.** Export, sign-out, account deletion and the privacy statements stay reachable. Buying or renewing opens the app exactly as it was.

## 2. Where each rule is enforced

| Rule | Enforced by | Where |
|---|---|---|
| One trial per account: new accounts from creation, existing accounts from first access | Database | `trial_grants` (primary key = account; `check (ends_at = started_at + 7 days)`), trigger `on_auth_user_created_grant_trial` for new accounts, `access_for` granting an existing account's trial the first time it is asked (migration 0014) |
| Trial can't be restarted by reinstalling, signing in again or changing phones | Database | The trial is one server-side row keyed by the account; once it exists, nothing restarts it. Nothing on the phone is involved |
| Nobody can grant themselves a plan | Database | `trial_grants` and `entitlements`: select-own RLS policy only; insert/update/delete revoked from `anon` and `authenticated`. `apply_payment_event`, `access_for`, `abuse_hit`: execute for `service_role` only |
| What an account may do now | Database | `access_for(uuid)` (service role) and `my_access()` (the signed-in person's own). Expiry is read against `now()`, so no scheduled job is needed |
| No new AI without the trial or the AI plan | **AI Edge Function** | `supabase/functions/ai/handler.ts`: `access_for` → `aiGate` (`access.ts`) before the cache, the quota or the provider. Basic → 403 `plan`; expired, refunded, revoked → 403 `plan`; unconfirmed trial email → 403 `verify`; lookup failure → 503 `access` (fails closed) |
| AI cost controls | AI Edge Function | Trial: 20 calls a day (`AI_TRIAL_DAILY_LIMIT`) and 200 trial calls a day per hashed network (`AI_TRIAL_NETWORK_DAILY_LIMIT`). AI plan: 80 a day (`AI_DAILY_LIMIT`). Everyone: `AI_GLOBAL_DAILY_LIMIT` (3000) |
| Paywall, no new records after expiry, one track in the trial | **App only** (UX, not security) | `apps/web/src/access.ts` (the gate), `store.ts` (`setWriteGate`, `setTrackLimit`), `App.tsx` (paywall), `screens/Paywall.tsx` |
| Recovery data is never gated | Design rule | No recovery table has a membership policy, check or trigger. `supabase/tests/membership.sql` proves a revoked account still syncs any number of tracks |

**What a modified APK can and can't do.** The app is untrusted. Someone who patches the APK can remove the paywall and keep logging on their own phone, and their rows still sync (recovery data is deliberately never gated; see §5). They **can't** get new AI output, because the AI function asks the database, not the app. They can't extend a trial or create a plan, because those rows are writable only by the service role. The paid value that costs money, AI, is the part enforced on the server. Non-AI use behind a patched APK is a known, accepted limitation.

## 3. The data model (migration 0014)

| Object | What it is |
|---|---|
| `trial_grants(user_id pk, started_at, ends_at, source)` | One per account. `source`: `signup` (a new account, from its creation), `first_access` (an account that existed before membership, from the first time it reached it), `launch` (a row an earlier version of 0014 wrote in advance; it starts at first access, once), `lazy` (earlier version). Cascades with the account |
| `entitlements(user_id pk, plan, status, period_start, period_end, provider, provider_ref)` | The current annual plan. `plan`: `basic` or `ai`. `status`: `active`, `expired`, `refunded`, `revoked`. Cascades with the account |
| `payment_events(id, provider, event_id, user_id, kind, plan, period_*, provider_ref, outcome, received_at)` | Append-only audit. `unique (provider, event_id)` makes webhook retries no-ops. `user_id` becomes null when the account is deleted (kept for refunds and accounting, linked to no one) |
| `abuse_salts(day, salt)`, `abuse_counters(kind, ip_hash, window_start, hits)` | Rate-limit counters keyed by `sha256(daily random salt ‖ address)`. Salts and counters older than two days are deleted, after which no stored hash can be matched to an address. No raw address is ever stored |
| (removed) `membership_launch`, `trial_start`, `set_membership_launch` | The earlier version's global launch date. 0014 drops them; trials no longer depend on any date but the account's own |
| `access_for(uuid) → jsonb` | `{state, app, ai, email_verified, tracks, valid_until, trial_ends_at, plan, plan_status, period_end, server_time}`. `state`: `trial`, `basic`, `ai`, `expired`, `refunded`, `revoked`, `none`. Order: active paid plan, then running trial, then why access ended |
| `my_access() → jsonb` | `access_for(auth.uid())` for the signed-in person |
| `apply_payment_event(...) → text` | The only write path for plans. See §7 |
| `network_key(ip)`, `network_hashes(ip)` | A network is an IPv4 address or an IPv6 /64; it is stored only as sha256(daily salt ‖ network), with today's and yesterday's salt so windows roll over midnight |
| `abuse_hit(kind, ip, window_minutes, limit) → bool` | Hashes and counts (trial AI per network); a missing or unreadable address is never refused |
| `signup_attempts(ip_hash, user_id, attempted_at)`, `signup_limits(window_minutes, max_accounts)` | Sign-ups per network, counted only once they became accounts, and the per-window limits (30 an hour, 100 a day). Service role only; attempts kept two days |
| `hook_before_user_created(event) → jsonb` | Supabase Auth "Before User Created" hook: refuses (`429`, `signup_rate_limited:`) only when the network has already created as many accounts as a `signup_limits` window allows; fails open on any error. **Not active until switched on in the dashboard** |

All functions are `security definer` with `set search_path = ''` and explicit grants. "Unknown or temporarily unavailable" is not a database state: it is what the app and the AI function do when `my_access`/`access_for` can't be reached (§6, §2).

**Trials have no launch date** (owner decision, 2026-11-03).
- **New accounts:** seven days from the moment the account is created (the sign-up trigger, `source = 'signup'`).
- **Accounts that existed before membership:** seven days from the first time the account reaches the updated membership system: an updated app asking `my_access()`, or the AI function asking `access_for()` (`source = 'first_access'`). Never from the registration date, so nobody is expired for having signed up months ago.
- **Rows written in advance by the earlier version** (production has 10, `source = 'launch'`, never seen by their owners): they start the same way, from first access, once.
- **Once only, server-side:** after the row exists, nothing restarts it: not reinstalling, signing out and in, or another phone. The account can't write the row (RLS).
- An account that never opens an updated app or uses AI simply has no trial running yet. That is intended.
- Re-running 0014 changes no trial.

## 4. Trial abuse: what is and isn't prevented

- **Account-based**: one trial per account, server-owned dates, can't be restarted by reinstalling, signing out and in, clearing data, or changing the phone's clock.
- **Email**: the app's sign-up flow expects a confirmation email ("Check your email", `screens/Account.tsx`). Whether the project *requires* confirmation before sign-in is a dashboard setting (Authentication → Sign In / Providers → Confirm email) that couldn't be checked from the repository. Either way, trial **AI** requires `email_confirmed_at`, so an address that never confirms can't spend AI.
- **Network rate limits** (hashed, short-lived): 30 new accounts an hour and 100 a day per network (once the hook is on; failed attempts don't count; IPv6 by /64), and 200 trial AI calls a day per network. These are limits, not bans: they lift on their own, never block paid accounts, and the hook lets sign-ups through if it fails.
- **Not prevented**: a person creating several accounts with several real email addresses gets several trials. Account-based enforcement can't stop that, and an IP address is not a person (mobile carriers and offices share them). Deleting an account and registering again with the same email also gets a new trial, because deletion removes everything about the account; keeping a hash of deleted emails would stop it but contradicts "delete removes everything" and is left as a product decision. No device fingerprinting is used.
- Supabase Auth's own sign-up rate limits and CAPTCHA (Authentication → Rate Limits / Attack Protection) are further options. They are dashboard settings and were not changed.

## 5. Downgrade and data safety

- Expiry, refund and revocation change **only** `entitlements.status` or pass a date. No recovery row is touched, by the database or the app.
- The app's write gate (`store.ts`) stops *new local changes* only. Rows arriving from the account ("remote") and erases ("reset") always go through. Sync keeps running behind the paywall, so changes made before access ended still upload.
- No RLS policy, CHECK constraint or trigger on a recovery table mentions membership. If one did, sync would treat the refusal as permanent (`sync.ts` `isRowLevel`) and strand rows on one phone. `supabase/tests/membership.sql` asserts a revoked account still inserts and reads its rows.
- The trial's one-track limit applies only to **opening** a track (`createTrack`). A restore (`importJson`), another phone's rows, or a plan ending never remove, archive or hide a track. Unarchive and resume are never gated.
- AI text already received (slip explanations on entries, weekly summaries in `weekly_reports`) stays forever. Only new requests are refused.
- It also stays **visible** (owner decision, 2026-11-04). Basic shows everything as usual. When access has ended, the paywall offers "View my history", which opens the whole app read-only: the calendar with each slip's explanation, Insights with every earlier weekly summary, the journal and every pet. Trying to record something, or the + button, brings the paywall back (`store.ts` `onWriteRefused`); background saves never do.
- Export is on the paywall, alongside sign-out and account deletion.

## 6. Offline behaviour

- After sign-in the app reads `my_access()`, validates it with `ServerAccess` (`packages/schema/src/membership.ts`) and keeps it in IndexedDB as `access:<account id>`.
- It refreshes on start, on coming back to the foreground (at most once a minute), when the network returns, and every 30 minutes while open. That is a handful of small RPCs per person per day.
- **Offline grace: 7 days** (`OFFLINE_GRACE_MS`). A kept answer is trusted for 7 days after it was fetched and **never past the trial's or plan's own end date**, which is checked every minute, offline too, in server time (the phone's clock offset at the last check is applied).
- After 7 days without reaching the server: paywall, reason "unconfirmed" (connect and check again). Nothing is lost.
- A phone that has never had an answer and can't reach the server shows "Can't check your membership" with Retry, Export and Account. It neither lets in nor shuts out.
- A server without migration 0014 (the function is missing) means membership is off: the app gates nothing, as before.
- Switching accounts: the kept answer is per account and is wiped with the phone's copy on sign-out (`resetAll` clears IndexedDB) and on a different account signing in (`App.tsx` owner check). An answer that arrives after sign-out is dropped.
- **Limitation**: offline, a person who sets the phone's clock back can stretch the grace period on that phone. It only affects local, non-AI use, which a patched APK could unlock anyway (§2).

## 7. Payments: Dodo Payments (integrated for test mode, not live)

**Provider: Dodo Payments.** The integration is complete for **test mode**; nothing has been deployed and no real payment is possible. Setup, secrets and the test plan: `docs/DEPLOY_MEMBERSHIP.md`, "Payments".

| Piece | File | What it does |
|---|---|---|
| Signature check and event mapping | `supabase/functions/_shared/dodo.ts` | Standard Webhooks on the raw body (`webhook-id`, `webhook-timestamp`, `webhook-signature`; HMAC-SHA256 of `id.timestamp.body` with the `whsec_` secret; 5-minute window; several signatures for key rotation) |
| Webhook (Dodo calls it) | `supabase/functions/dodo-webhook` | Deployed without Supabase's JWT check; refuses everything (503) until its secrets are set, and every unsigned request (401) |
| Checkout (the app calls it, signed in) | `supabase/functions/dodo-checkout` | `POST /checkouts` for one plan, tagged with the account; Basic → AI through `POST /subscriptions/{id}/change-plan` after the person confirms |
| Database | `supabase/migrations/0016_dodo_payments.sql` | Extends `apply_payment_event` (no second write path): customer, payment and subscription ids, event time, renewal flag, review notes |
| App | `apps/web/src/billing.ts`, `screens/Paywall.tsx`, `deeplink.ts` | Plan buttons on the paywall and Me → Membership; the return link and the browser closing only make the app ask the server again |

**Products are an allowlist on the server.** `DODO_BASIC_PRODUCT_ID` and `DODO_AI_PRODUCT_ID` are Edge Function secrets. The app sends only `{ plan: "basic" | "ai" }`; a product id, price, amount or account id in the request is ignored. The account is always the signed-in user from the login token.

**Environments.** `DODO_PAYMENTS_ENVIRONMENT=test_mode` uses `https://test.dodopayments.com`. `live_mode` is refused unless `DODO_PAYMENTS_LIVE_ENABLED=true` is also set, so a typo can't take real money. No other host ever receives the API key.

**Dodo event → Pawse** (field names checked against Dodo's SDK, `dodopayments@2.61.1`):

| Dodo event | Pawse kind | Effect |
|---|---|---|
| `subscription.active`, `subscription.plan_changed`, `subscription.updated` (status active) | purchase | Grants or changes the plan for the paid period (previous → next billing date). The same period again is `stale` |
| `subscription.renewed` | renewal | Extends the year |
| `subscription.on_hold`, `.past_due`, `.failed`, `payment.failed` | payment_failed | Recorded; access runs to the end of the paid period |
| `subscription.cancelled` | cancellation | Recorded; `renews = false`; access runs to the end of the paid year |
| `subscription.expired` | expiry | Ends access (stale if a later period was already paid) |
| `payment.succeeded` | payment | Recorded: maps the payment id to its account and subscription, so a later refund finds them |
| `refund.succeeded` (full) | refund | Ends access at once, for the account and subscription of the refunded payment |
| `refund.succeeded` (partial) | partial_refund | Held for review; access unchanged |
| `dispute.lost` | revocation | Ends access, through the disputed payment |
| everything else (`payment.processing`, `refund.failed`, `dispute.opened`, …) | — | Acknowledged (200), nothing recorded |

**Finding the account.** From the checkout's metadata (`pawse_account_id`, copied by Dodo onto the payment and subscription), or, for events without it (renewals, plan changes, refunds), from what is already recorded for that subscription or payment. Refunds carry only a `payment_id`, so they always go through the recorded payment.

**Never applied, held for review (`outcome = needs_review`, with a `note`):** an event whose metadata names a different account from the one its subscription or payment already belongs to (`account_mismatch`; applied to neither); a purchase, payment or refund that can't be tied to any account (`no_account_link`); a partial refund; a refund whose payment has no subscription while the account has one (`refund_without_subscription`); a second subscription for the plan already held (`second_subscription`); a lower plan bought on another subscription while a higher one runs (`lower_plan_while_active`). The owner reviews them with `select * from payment_events_review;` (service role).

**Ordering and duplicates.** `(provider, event_id)` is unique, so a redelivered webhook is `duplicate`. Each entitlement keeps the time of the last event applied from its subscription; an older event delivered late is `stale` and can't undo a newer one (for example a late `subscription.active` for Basic after an upgrade).

**Coming back from the checkout.** The return address is `app.detoxcompanion://checkout-return` (or an https page that links to it). Cancelling sends people to the same address with `?pawse_checkout=cancelled`. The app reads Dodo's `status` only to choose its words, then asks `my_access()` again: at once, then backing off for about two minutes, until a new or longer paid plan appears. If none appears, it says the payment isn't confirmed yet and that nothing was charged if they didn't finish. A checkout begun on the phone is remembered for two hours, so closing the app mid-checkout (or a slow webhook) is picked up at the next launch. Opening the return link by hand changes nothing.

- **Client boundary**: `apps/web/src/billing.ts` (`CheckoutProvider`). Builds without `VITE_CHECKOUT=dodo` use `noCheckout` (`available: false`): no buy buttons, and the paywall says nothing can be bought.
- **Server boundary**: `supabase/functions/_shared/payments.ts`. `processPaymentWebhook` returns 401 for an unverified request (records nothing), 400 for a malformed event, 500 for a database error (Dodo retries), and 200 with the outcome otherwise.
- **Database**: `apply_payment_event` records the event once and applies it in the same transaction, with the account's row locked. Only the service role can call it.

| Event | Effect |
|---|---|
| `purchase`, `renewal`, `grant` | Activates or extends the plan. Upgrades switch at once; a plan change down on the same subscription applies; a later period of the same plan extends; an older period is `stale` |
| `payment`, `payment_failed`, `cancellation` | `recorded`; the paid period runs on |
| `expiry` | Ends the current period. An expiry for a period that has since been renewed is `stale` |
| `refund`, `revocation` | Ends access at once. About a purchase that has since been replaced: `stale` |
| `partial_refund` | `needs_review` |
| Any event seen before | `duplicate`, nothing changes |
| Unknown or deleted account | `no_account` (or `needs_review` when nothing ties it to an account) |

**Still needed before real payments:** see `docs/DEPLOY_MEMBERSHIP.md`, "Before accepting real payments". A manual `grant` (support, testing) can still be applied with `select apply_payment_event('manual', '<unique id>', '<user id>', 'grant', 'ai', now(), now() + interval '1 year', null);` as the service role.

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

The production runbook is **`docs/DEPLOY_MEMBERSHIP.md`**: what production has today, the order and why, the scripts in `supabase/deploy/membership/`, verification and rollback. It was rehearsed against a copy of production's audited state.

### Deployment risks (reviewed and fixed 2026-11-03, nothing deployed)

**Deno.** `supabase/functions/ai/deno.json` pins the function's own Deno setup (`nodeModulesDir: "none"`, so the repo's pnpm `package.json` can't switch Deno into `node_modules` mode), and `deno.lock` (frozen) pins every npm package, transitive ones included, with integrity hashes. The lock is **format version 4**, written with Deno 2.1.4, because Deno 2.1 can't read the version 5 that newer Deno writes, and the Edge Runtime's Deno version isn't documented. Checked locally (Deno installed in a scratch folder, not in the project):
- `deno check` passes in place, from the function's folder and from the repo root with `--config supabase/functions/ai/deno.json`, with Deno 2.1.4 and 2.5.6, from a clean cache. Neither version rewrites the lock.
- A lock with a tampered integrity hash is refused.
- The real `index.ts` boots under both versions; no token and a forged token → 401 (the auth lookup fails closed when unreachable).
- The handler ran under Deno: Basic → 403 before the provider, a trial → an answer (zod via `npm:`, `crypto.subtle`, `AbortSignal.timeout`), and the webhook contract rejected an unsigned call.

**Changing the function's npm imports** means regenerating the lock, with Deno 2.1 so it stays readable by older runtimes: in `supabase/functions/ai`, set `"frozen": false`, run `deno check index.ts`, set it back to `true`, and commit both files.

**Still to check on Supabase itself** (not possible here: no Supabase CLI or project):
1. `supabase functions serve ai` (or a deploy to a staging project) uses the per-function `deno.json` and lock as Supabase documents; confirm once.
2. The client address header: `clientIp` reads `x-forwarded-for`, then `cf-connecting-ip`, then `x-real-ip`. If production sends none, the trial network limit does nothing (it never blocks; the per-account limit still applies). Check one trial call in the function logs.
3. The sign-up hook's plan availability: Supabase lists Auth hooks as beta and doesn't say which plans include this one. Check Authentication → Hooks. Nothing else depends on it.

**The sign-up hook (`hook_before_user_created`), as fixed:**
- **Fails open.** Everything it does runs inside an exception handler with a 500 ms lock timeout. Any error (an unexpected payload, a lock, a missing table) lets the sign-up through and logs a warning with the error code only, never the address. Tested by breaking each of its tables.
- **Counts accounts, not attempts.** Each attempt is recorded with the id the new account would get (`signup_attempts`), and only attempts that became accounts count. A weak password, a taken email or a network error uses nothing up. A retry of the same sign-up isn't counted against itself.
- **Fair to shared networks.** Limits are per network over rolling windows: **30 new accounts an hour and 100 a day** by default, in `signup_limits` (tune with an `update`, no migration). Mobile carriers put many people behind one IPv4 address, and pawse's whole sign-up rate is far below these numbers, so only scripted account farming reaches them. IPv4 counts by address; IPv6 counts by /64 (one home connection or one phone), since one device can rotate through its whole /64. Yesterday's salt is still checked, so the daily window doesn't reset at midnight.
- **Clear message.** A refusal is HTTP 429 with a message starting `signup_rate_limited:`. The app shows `account.errors.signup_network` instead ("…paused for a while. Try again in an hour, or switch connection… If you already have an account, sign in instead."), not the generic "Wait a minute". A test reads the exact text from the migration, so the two can't drift apart.
- **Privacy.** Only salted hashes are stored. Attempts, counters and salts older than two days are deleted, after which no hash can be matched to an address. A row links a network hash to an account id for at most two days.
- **Runs with the definer's rights** (needed to write its tables), like Supabase's own `handle_new_user` pattern. Only `supabase_auth_admin` may execute it.

**The sign-up trigger (`on_auth_user_created_grant_trial`):** a trigger on `auth.users` that fails blocks sign-up. `grant_trial` only inserts, with `on conflict do nothing`, and `trial_start` falls back to `now()`, so it has no known failure path; it is tested locally, not on Supabase. Try one sign-up on a staging project first.

**Rollback**: redeploy the previous `ai` function to stop enforcing AI by plan. The 0014 tables can stay; an app version without `my_access` ignores them. To stop the paywall in the app, ship an app build where `startAccess` isn't called, or drop `my_access()` (the app treats a missing function as membership off).

## 10. Tests

| What | Where |
|---|---|
| Trial grant, uniqueness, 7-day check, registration-dated, lazy rebuild; RLS and privileges; every access state; payment transitions, duplicates, stale and out-of-order events, refunds, revocation, renewal after expiry, unknown accounts, account deletion; abuse counters and the hook; recovery rows never gated | `supabase/tests/membership.sql` (81 checks, including the sign-up hook: accounts not attempts, IPv6 /64, rolling windows, tunable limits, failing open) |
| Trials without a launch date: existing accounts start at first access (from the app or the AI function), not registration; never restarted; rows written in advance start once; new accounts from creation; re-running 0014 | `supabase/tests/membership-trials.sql` (17 checks) |
| Dodo: signatures (made independently), every event mapping, the webhook (configured or not, forged, wrong secret, replayed, duplicate, ignored, database down), the checkout (not configured, test/live guard, return address, allowlisted products only, not signed in, already subscribed, upgrade with confirmation, Dodo refusing) | `apps/web/test/dodo.test.ts` |
| Dodo lifecycle in the database: purchase, duplicate, second subscription, upgrade, late older event, downgrade, renewal, failed payment, cancellation, expiry, partial / old / untraceable / current refund, wrong account, recovery rows untouched, past AI text still readable | `supabase/tests/dodo-payments.sql` |
| Signed webhooks → the real handler → real Postgres with every migration (opt-in, `DODO_IT_PG`) | `apps/web/test/dodo-db.integration.test.ts` |
| Coming back from checkout: return hints, a late webhook, the success link without paying, cancelled, failed, browser close and link together, restart within two hours; starting a checkout sends only the plan | `apps/web/test/checkout.test.ts` |
| Plans offered with checkout on: paywall, trial, Basic (upgrade only), AI (nothing) | `apps/web/test/paywall-checkout.test.tsx` |
| Past AI text on screen for Basic, expired, refunded and revoked (DayDetail, earlier weekly summaries); trying to record behind the paywall brings it back | `apps/web/test/membership.test.ts` |
| AI function called directly: no token, forged token, each state, unconfirmed email, lookup failure, cache not bypassing membership, trial and plan limits, network limit, global switch | `apps/web/test/ai-function.test.ts` |
| The app's gate: states, offline grace, clock offset, end dates offline, account switching, late answers, malformed answers, missing function, renewal; the store refusing new records but keeping everything; export after expiry; AI text kept; remote rows still applied; trial's one track; restore keeping every track; sync uploading behind the paywall | `apps/web/test/membership.test.ts` |
| Paywall wording in every Voice, no buy button without a provider, export and account controls present | `apps/web/test/paywall.test.tsx` |
| Webhook contract: signature, provider mismatch, duplicates, malformed events, database failures, no provider | `apps/web/test/payments.test.ts` |
| Access answer schema | `packages/schema/test/membership.test.ts` |

## 11. Decisions that need the product owner

1. Re-registering after deleting an account gets a new trial (§4).
2. The offline grace period: 7 days (§6).
3. Trial AI limits: 20 calls a day per account, 200 a day per network (§2).
4. Basic bought while AI is active is held for review rather than queued (§7).
5. A refund during the trial ends the plan but not the remaining trial days (the trial belongs to the account).
6. "One pet" in the trial is read as one recovery track and its pet; adopting again after a pet's death (classic rules) stays allowed.
7. The paywall heading uses the product name as the brand writes it ("pawse — Your commitment to change."), not "PAWSE".
8. Prices in other currencies, taxes, and terms of sale (Dodo Payments is the provider).
9. Basic → AI is charged by Dodo as a prorated amount on the card on file (`prorated_immediately`), after an in-app confirmation. Confirm in test mode that this is the wanted behaviour.
10. AI-written pet lines are daily (one request per pet per day, for that day's counts) and kept 7 days on the phone (§2's retention). On Basic or after access ends, today's lines already written stay; a new day shows the hand-written lines rather than an older AI line with yesterday's numbers.
