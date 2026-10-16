# Demo script (about 10 minutes)

Works locally with no keys, and on a deployed site (the demo workspace is always simulated).

## Setup (once)
```bash
npm install
npm run dev            # http://localhost:3000, embedded database, everything mocked
```
On a deployed site with a real scorer, run `npm run db:seed` once against the production database to create the demo workspace.

## Script

**1. The problem (landing page, 1 min).** Open `/`. "You get 200 applicants for a delivery role. Today someone phones them one by one. Here, they answer on WhatsApp and you get a ranked list." Point at the price: one price per job, UPI, no subscription.

**2. A finished job (demo workspace, 3 min).** Click **See a demo workspace** → *Delivery Executive*.
- Progress panel: completed, needs you, opted out.
- **Shortlist:** ranked by must-haves, then score. Point out *Must-have not met* (Priya doesn't have a bike yet) and *Needs you* (Nikhil replied "ok" and 👍).
- Open **Imran Shaikh**: answered in Hinglish, one by voice note. Show the reason, the evidence per criterion, and the full WhatsApp transcript. "You can edit the score; it's logged."
- Back on the shortlist: **Export CSV** and **Create link** (client share page, no phone numbers).

**3. Live run (4 min).** Jobs → *Telecaller (Hindi)* (free test mode, 3 candidates seeded) → **Start free test** → **Phone simulator**.
- As Anjali: tap **YES**, answer a question, tap **repeat**, send one answer with 🎤 (voice note), finish. Watch the Hindi replies.
- As Rahul: tap **STOP**. "Opt-out is honoured instantly; he gets nothing else."
- Back to the shortlist: Anjali is scored.

**4. Setting up a job (2 min).** Jobs → **New job** → *Fill with a sample role* → show *Draft questions with AI*, must-haves vs weighted nice-to-haves, free test mode. (Uploads are off in the shared demo; in a real account, the upload preview shows bad numbers, missing consent and duplicates before anything is saved.)

**5. Close.** "₹1,499 per job up to 200 candidates; your first 5 are free. Want to run your next real role on it?"

## Things not to promise yet
Real WhatsApp delivery times, transcription accuracy for Hindi voice notes, and any legal-compliance claim. See TODO.md.
