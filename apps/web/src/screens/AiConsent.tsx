import { actions, useData } from "../store";
import { syncNow } from "../sync";
import { Switch } from "../ui/Controls";
import { toast } from "../ui/Toast";

/**
 * The choice, and what it means, in one place: You > AI writing, and from Insights. What it lists is what
 * store.slipRequest and store.weekRequestFor send through ai.ts. If those change, change this text with them.
 */
export function AiConsent() {
  const { settings } = useData();
  const on = settings.aiConsent;
  function set(v: boolean) {
    actions.setAiConsent(v);
    // Pawse's server reads this choice from the account too, so send it now rather than at the next sync.
    if (v) void syncNow();
    toast(v ? "AI writing is on" : "AI writing is off. Nothing more is sent.", { kind: v ? "good" : "info" });
  }
  return (
    <section className="card stack">
      <Switch checked={on} onChange={set} label="AI writing" hint={on ? "On. Turn it off any time." : "Off. Nothing is sent."} />
      <div className="stack tight">
        <b>What it does</b>
        <p className="small">Pawse can ask an AI model for two short pieces of writing: a sentence beside the app's own words after a slip, and a written summary of your week. The AI only writes words. It never changes your records, your numbers or your pet's age.</p>
      </div>
      <div className="stack tight">
        <b>What is sent when it's on</b>
        <p className="small">The kind of habit (for example smoking or scrolling), your pet's name, the amount and your usual amount, the situations you tapped (like stressed or late at night), how many slips you've logged recently, this week's and last week's totals, and the tone you chose.</p>
      </div>
      <div className="stack tight">
        <b>What is never sent</b>
        <p className="small">Notes you type, reflections, your journal, photos, your plan and reasons, your name, your email or your account.</p>
      </div>
      <div className="stack tight">
        <b>Where it goes</b>
        <p className="small">To Pawse's server, which passes it to OpenRouter and an AI model (today's default is OpenAI GPT-4.1 mini). Pawse asks OpenRouter to use only providers that say they don't keep or train on requests, but Pawse can't check what they do. Pawse's server knows which account is asking, to apply a daily limit and to keep a saved copy of each answer for 7 days so the same request isn't repeated, then deletes it. Written weekly summaries are removed from this phone and your account once their week is a week old.</p>
      </div>
      <p className="muted small">Turning it off stops all sending straight away. Writing already saved stays as it is. Check-ins, streaks, the calendar and your pet work the same either way.</p>
    </section>
  );
}
