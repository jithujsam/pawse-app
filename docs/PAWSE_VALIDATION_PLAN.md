# Pawse validation plan (3.0)

Date: 2026-10-24 · Nothing here has been run yet.

## Questions

1. **Comprehension.** Do people understand the five day states, "not tracking", and that unrecorded days don't count?
2. **Urge support.** Do people use it, switch strategies, and report urges as managed? Which strategies do they come back to?
3. **Slip recovery.** After a slip, do people come back within 3 days more often than under 2.x? (Abstinence-violation proxy.)
4. **Weekly review.** Do people complete it and pick an adjustment, and does that week look different from the one before?
5. **Pet rules.** Does continuity (no death) reduce drop-off after a bad week without making the pet feel meaningless? Who turns on classic rules, and why?
6. **Safety.** Does crisis detection fire on real crisis language and not on ordinary notes? Any reports of the app feeling shaming?

## Methods

### A. Moderated usability sessions (5–8 people, before release)
Target adults with a self-named habit. Tasks: onboard with a plan; handle a pretend urge; log a slip and reflect; read Insights; find and change the plan. Measure task success, time, misread states, and words used to describe the pet. Ask: "What does a grey dot mean?" "What happens if you don't open the app for a week?"

### B. Pilot (20–50 people, 4 weeks; PRD §14 phase 5)
Requires an explicit privacy decision: Pawse has no analytics today. Options, in order of preference:
1. **Self-report only:** in-app opt-in weekly survey (3 questions), stored in the person's own rows.
2. **Consented aggregate export:** participants export their JSON backup and share it with consent; analysed offline.
3. Server-side counts from existing tables under a research consent and a written retention period.

Metrics (per person, then medians): share of days recorded; urges logged and managed; strategies used; return-within-3-days after a slip; weekly reviews completed; goal-relative change week 4 vs week 1; D7/D30 retention; classic-rules opt-in rate. Qualitative interviews at week 2 and week 4.

### C. Safety checks
- Crisis phrase list reviewed by a clinician; false-negative examples added to `test/crisis.test.ts`.
- Copy review of all three tones for shame or medical claims.
- Notification count per day measured on Android 13–15 devices (audit B5b).

## Decision rules (set before the pilot)

- If ≥30% of participants misread "not recorded" as failure in sessions, redesign the state legend before release.
- If return-within-3-days after a slip doesn't improve versus 2.x baseline cohorts (or ≥60% if no baseline), revisit the slip screen.
- If the urge flow is opened by <20% of participants over 4 weeks, test making it more prominent before adding strategies.
- If anyone reports feeling shamed or frightened by the pet, review that copy path immediately.

## Not claimed

No claim that Pawse reduces any behaviour. Store and release copy must stay at "helps you notice patterns, get through urges and plan".
