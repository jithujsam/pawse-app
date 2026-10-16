# Deploy, backups and rollback

Target: Vercel (app + cron) and a managed Postgres (Neon via the Vercel Marketplace, or Supabase). Both have free tiers that are enough for demos.

## Demo deploy on Vercel (about 15 minutes)
This gives you a public URL with the full app on simulated WhatsApp and payments: safe to show anyone.

1. **Connect the repo.** vercel.com → *Add New → Project* → import `jithujsam-cloud/commandcode` (skip if the project already exists). Framework: Next.js. Leave the build command alone: `vercel.json` sets it.
2. **Add a database.** Project → *Storage* → *Create Database* → **Neon** (free plan) → connect it to the project for all environments. This adds `DATABASE_URL` (and `DATABASE_URL_UNPOOLED`) automatically.
3. **Add two secrets.** Project → *Settings → Environment Variables*, for Production and Preview:
   - `SESSION_SECRET`: any random string of 32+ characters.
   - `DATA_ENCRYPTION_KEY`: exactly 64 hex characters (`openssl rand -hex 32`). Keep a copy somewhere safe: losing it makes stored phone numbers unreadable.
   - Optional: `SUPPORT_EMAIL` (shown on the site), `OPS_EMAILS` (your email, to open `/ops`).
4. **Deploy.** *Deployments → Redeploy*, or push/merge to `main`. The build applies database migrations itself before building.
5. **Open the URL** and click **See a demo workspace**. The first click seeds the demo data (a few seconds).

`APP_URL` is worked out from Vercel's own variables; set it only when you add a custom domain.

What works in this mode: everything in `docs/DEMO.md`. Email sign-in is switched off until an email provider is configured (otherwise sign-in links would have to be shown on screen, which is unsafe in production); the demo workspace button is the way in.

**Preview deployments** (any branch other than `main`) are protected by Vercel Authentication by default, so only people on your Vercel team can open them. Use the production URL for prospects, or turn protection off under *Settings → Deployment Protection*.

## Going live per provider
- **Email:** `MAILER_PROVIDER=resend`, `RESEND_API_KEY`, `MAIL_FROM` on a verified domain. Turns on email sign-in.
- **Scoring:** `SCORER_PROVIDER=claude`, `ANTHROPIC_API_KEY`. (Then seed the demo with `npm run db:seed` instead of the first click.)
- **Payments:** `PAYMENT_PROVIDER=razorpay` + keys; in Razorpay, add webhook `https://<app>/api/webhooks/payments` for `payment_link.paid` and `payment_link.cancelled` with `RAZORPAY_WEBHOOK_SECRET`.
- **WhatsApp:** `WHATSAPP_PROVIDER=cloud` + token, phone number id, app secret, verify token; in Meta, set the webhook to `https://<app>/api/webhooks/whatsapp` and subscribe to `messages`.
- Set `CRON_SECRET` before going live (Vercel sends it to `/api/cron`).

## Background jobs
Requests that enqueue work (uploads, payments, replies) process the queue right after responding. `vercel.json` also runs `/api/cron` once a day, the most the Hobby plan allows; it sends reminders, times out silent candidates and purges expired data. On a Pro plan, change the schedule to `*/10 * * * *` so reminders go out within 10 minutes of being due. Check `/status` for delayed messages.

## Database permissions
The row-level-security migration creates an `app_user` role and grants it to the connecting user, so that user needs `CREATEROLE`. The default owner role on Neon and Supabase has it. Verified against Postgres 16 with a non-superuser owner.

## Backups
- Use the provider's point-in-time recovery (Neon: history retention; Supabase: PITR add-on). Set retention to at least 7 days.
- Weekly logical backup as a second copy: `pg_dump --format=custom "$DATABASE_URL" > backup-$(date +%F).dump`, stored encrypted outside the provider.
- Test a restore into a scratch database once a month.
- Backups contain candidate data: their retention must be compatible with the deletion promise (TODO.md, lawyer question).

## Rollback
- **Code:** Vercel → Deployments → previous deployment → *Promote to Production*. Instant, no rebuild.
- **Migrations are forward-only.** Make every migration backward compatible with the previous release (add columns/tables first, remove them in a later release), so a code rollback never needs a schema rollback.
- **Bad migration or data issue:** restore to a point in time into a new branch/database, verify, then switch `DATABASE_URL` and redeploy.
- **Stop all outbound messages fast:** set `WHATSAPP_PROVIDER=mock` and redeploy (the queue keeps working, nothing reaches phones), or pause the cron in Vercel.
