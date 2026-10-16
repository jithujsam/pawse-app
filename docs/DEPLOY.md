# Deploy, backups and rollback

Target: Vercel (app + cron) and a managed Postgres (Neon or Supabase). Both are paid beyond free tiers: confirm before creating accounts.

## First deploy
1. Create a managed Postgres database; copy its connection string.
2. Apply migrations from your machine: `DATABASE_URL=... npm run db:migrate`.
   The RLS migration creates a `app_user` role and grants it to the connecting user, so that user needs `CREATEROLE` (the default owner role on Neon and Supabase has it).
3. In Vercel project settings → Environment Variables, set at least: `DATABASE_URL`, `APP_URL`, `SESSION_SECRET` (random 32+ chars), `DATA_ENCRYPTION_KEY` (`openssl rand -hex 32`, store it safely: losing it makes phone numbers unreadable), `CRON_SECRET`, `SUPPORT_EMAIL`, `OPS_EMAILS`. Leave providers on `mock` until each live integration is tested (TODO.md).
4. Deploy. The app refuses to start in production without `DATABASE_URL`, `SESSION_SECRET` and `DATA_ENCRYPTION_KEY`.
5. Seed the demo workspace: `DATABASE_URL=... npm run db:seed`.
6. Check `/status` and `/api/health`.

## Going live per provider
- **Email:** `MAILER_PROVIDER=resend`, `RESEND_API_KEY`, `MAIL_FROM` on a verified domain.
- **Scoring:** `SCORER_PROVIDER=claude`, `ANTHROPIC_API_KEY`.
- **Payments:** `PAYMENT_PROVIDER=razorpay` + keys; in Razorpay, add webhook `https://<app>/api/webhooks/payments` for `payment_link.paid` and `payment_link.cancelled` with `RAZORPAY_WEBHOOK_SECRET`.
- **WhatsApp:** `WHATSAPP_PROVIDER=cloud` + token, phone number id, app secret, verify token; in Meta, set the webhook to `https://<app>/api/webhooks/whatsapp` and subscribe to `messages`.

## Background jobs
`vercel.json` runs `/api/cron` every 10 minutes (Vercel sends `Authorization: Bearer $CRON_SECRET`). Requests that enqueue work also drain the queue right after responding. Check `/status` for delayed messages.

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
