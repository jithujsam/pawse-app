import { useState } from "react";
import { getGate, refreshAccess, useGate, type Gate } from "../access";
import { checkout, type PlanId } from "../billing";
import { downloadBackup } from "../exportData";
import { useData } from "../store";
import { useSession } from "../supabase";
import { CONTACT_EMAIL } from "../brand";
import { fmtDay, iso } from "../dates";
import { Button, PawLogo } from "../ui/Controls";
import { toast } from "../ui/Toast";
import { t, tt } from "../text";
import { Account, SignOut } from "./Account";

/**
 * Shown instead of the app when access has ended (trial over, year over, refunded or withdrawn) or can't be confirmed.
 * Nothing behind it is deleted, hidden for good or changed: sync keeps running, so changes logged earlier still back
 * up, and buying or renewing opens the app exactly as it was. Export, sign-out and account deletion stay here.
 */
export function Paywall({ gate }: { gate: Extract<Gate, { kind: "locked" }> }) {
  const tone = useData().settings.tone;
  const { session } = useSession();
  const [busy, setBusy] = useState(false);
  const a = gate.access;
  const intro = gate.reason === "refunded" ? t("membership.paywall.refunded")
    : gate.reason === "revoked" ? t("membership.paywall.revoked", { email: CONTACT_EMAIL })
    : gate.reason === "unconfirmed" ? t("membership.paywall.unconfirmed")
    : a.plan ? tt("membership.paywall.intro_plan", tone) : tt("membership.paywall.intro_trial", tone);

  async function check() {
    setBusy(true);
    await refreshAccess();
    setBusy(false);
    // The app swaps this screen out by itself when access is back; say so either way.
    const open = getGate().kind === "open";
    toast(open ? t("membership.paywall.reopened") : t("membership.paywall.still_closed"), { kind: open ? "good" : undefined });
  }

  return (
    <main className="screen paywall" aria-label={t("membership.paywall.aria")}>
      <div className="stack">
        <PawLogo size={40} />
        <h1>{t("membership.paywall.title")}</h1>
        <p>{intro}</p>
        <p className="muted">{t("membership.paywall.need")}</p>
      </div>

      <div className="stack">
        <Plans accountId={session?.user.id} />
        <Button variant="secondary" disabled={busy} onClick={() => void check()}>{busy ? t("membership.paywall.checking") : t("membership.paywall.check")}</Button>
      </div>

      <section className="card stack">
        <h2>{t("membership.paywall.data_title")}</h2>
        <p className="small">{t("membership.paywall.data_body")}</p>
        <Button variant="secondary" onClick={() => downloadBackup()}>{t("membership.paywall.export")}</Button>
      </section>

      <section className="card stack">
        <h2>{t("membership.paywall.account_title")}</h2>
        <Account />
        <SignOut />
      </section>
    </main>
  );
}

function PlanCard({ plan, name, price, body, accountId }: { plan: PlanId; name: string; price: string; body: string; accountId: string | undefined }) {
  return (
    <div className="card stack tight">
      <div className="row"><h2>{name}</h2><b>{price}</b></div>
      <p className="small">{body}</p>
      {/* Only a connected provider gets a button. Without one, nothing pretends it can be bought. */}
      {checkout.available && accountId && (
        <Button onClick={() => { void checkout.startCheckout(plan, accountId).finally(() => void refreshAccess()); }}>{t("membership.paywall.choose", { plan: name })}</Button>
      )}
    </div>
  );
}

/** First sign-in on this phone, and the server can't be reached: membership can't be checked yet. */
export function AccessUnverifiable() {
  const [busy, setBusy] = useState(false);
  return (
    <main className="screen paywall" role="alert">
      <div className="stack">
        <PawLogo size={40} />
        <h1>{t("membership.unverifiable.title")}</h1>
        <p className="muted">{t("membership.unverifiable.body")}</p>
        <Button disabled={busy} onClick={async () => { setBusy(true); await refreshAccess(); setBusy(false); }}>{busy ? t("membership.paywall.checking") : t("membership.unverifiable.retry")}</Button>
      </div>
      <section className="card stack">
        <h2>{t("membership.paywall.data_title")}</h2>
        <Button variant="secondary" onClick={() => downloadBackup()}>{t("membership.paywall.export")}</Button>
      </section>
      <section className="card stack">
        <h2>{t("membership.paywall.account_title")}</h2>
        <Account />
        <SignOut />
      </section>
    </main>
  );
}

/** The days left in a trial, counted in whole days from now (0 means it ends today). */
export function daysLeft(until: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((until - now) / 86_400_000) - 1);
}

/** Membership on Me → Membership (the page title names it): what the account has and until when. Nothing when membership isn't on. */
export function MembershipCard() {
  const gate = useGate();
  if (gate.kind !== "open") return null;
  const a = gate.access;
  const until = gate.until;
  const date = until ? fmtDay(iso(new Date(until))) : "";
  const left = until ? daysLeft(until) : 0;
  return (<>
    <section className="card stack tight" aria-label={t("membership.status.title")}>
      {a.state === "trial" && <p>{left === 0 ? t("membership.status.trial_today") : left === 1 ? t("membership.status.trial_one") : t("membership.status.trial_other", { n: left })}</p>}
      {a.state === "trial" && date && <p className="muted small">{t("membership.status.trial_ends", { date })}</p>}
      {a.state === "trial" && <p className="muted small">{t("membership.status.trial_note")}</p>}
      {a.state === "trial" && !a.email_verified && <p className="small">{t("membership.status.verify")}</p>}
      {a.state === "basic" && <><p>{t("membership.status.basic", { date })}</p><p className="muted small">{t("membership.status.basic_note")}</p></>}
      {a.state === "ai" && <p>{t("membership.status.ai", { date })}</p>}
      {gate.stale && <p className="muted small">{t("membership.status.offline", { date: fmtDay(iso(new Date(Date.parse(a.server_time)))) })}</p>}
    </section>
    {/* During the trial, and on Basic (which can add AI), what each plan includes, so the end of the trial is never a surprise. */}
    {a.state !== "ai" && <Plans accountId={undefined} />}
  </>);
}

/** The two annual plans, side by side in words. A buy button appears only when a payment provider is connected. */
function Plans({ accountId }: { accountId: string | undefined }) {
  return (
    <section className="stack" aria-label={t("membership.paywall.plans_aria")}>
      <PlanCard plan="basic" name={t("membership.paywall.basic_name")} price={t("membership.paywall.basic_price")} body={t("membership.paywall.basic_body")} accountId={accountId} />
      <PlanCard plan="ai" name={t("membership.paywall.ai_name")} price={t("membership.paywall.ai_price")} body={t("membership.paywall.ai_body")} accountId={accountId} />
      <p className="muted small">{t("membership.paywall.annual")}</p>
      {!checkout.available && <p className="small" role="note">{t("membership.paywall.no_checkout")}</p>}
    </section>
  );
}

/** The short status on Me's Membership row: "Trial · 5 days left", "Basic", "AI". Null when membership isn't on. */
export function membershipRowValue(gate: Gate, now = Date.now()): string | null {
  if (gate.kind !== "open") return null;
  const a = gate.access;
  if (a.state === "basic") return t("membership.status.row_basic");
  if (a.state === "ai") return t("membership.status.row_ai");
  if (a.state !== "trial" || gate.until === null) return null;
  const left = daysLeft(gate.until, now);
  return left === 0 ? t("membership.status.row_trial_today") : left === 1 ? t("membership.status.row_trial_one") : t("membership.status.row_trial_other", { n: left });
}

/** A trial with two days or less to go: when it ends, for the one-line notice on Home. Null otherwise. */
export function trialEndingSoon(gate: Gate, now = Date.now()): string | null {
  if (gate.kind !== "open" || gate.access.state !== "trial" || gate.until === null) return null;
  return daysLeft(gate.until, now) <= 2 ? fmtDay(iso(new Date(gate.until))) : null;
}
