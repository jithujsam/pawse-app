# Check-in questions

What the app asks after a slip, and why. Built by `buildFields` in `apps/web/src/questions.ts`.

## Principles

- **Under 15 seconds** (PRD 3.4). Every question is one tap. Only the amount is required.
- **Ordered like a functional analysis**, the standard way counsellors break down a slip in CBT for habits and addictions: what happened, what led up to it, what came after.
- **Ask about the factors research links to slips**: emotional state (stress, boredom, loneliness, tiredness, anger, the HALT checklist), how strong the craving was, place, company, and whether it was planned. These are the same contexts that ecological momentary assessment studies of smoking, drinking and spending track.
- **Never ask about calories, weight or eating less** (PRD 15).

## The set

| # | Question | Type | Feeds |
|---|---|---|---|
| 1 | How much / how many / how many minutes? | number (required when the habit has a unit) | Severity vs the person's own median |
| 2 | What was it? (habit-specific answers, e.g. Delivery order, Instagram, Vape, Sports bet) | pick one | Report patterns, AI context |
| 3 | What was going on? (moods picked in onboarding) | pick any; stress, boredom, loneliness, tiredness, upset are triggers | Severity (+0.25 each, max +0.5), "What sets it off most" |
| 4 | How strong was the urge? | 1 to 5 | "Average urge" |
| 5 | Was it planned? | pick one; spur of the moment and more than planned are triggers | Severity, the PRD's "extra beyond planned" |
| 6 | Where were you? | pick one | "Where it happens most" |
| 7 | Who were you with? | pick one; alone is a trigger | Severity, PRD's "alone" flag |
| 8 | How do you feel now? | pick one | "How it felt after", share worse or regretted |
| 9 | Photo | optional, stays on the phone | Calendar |

Late night (22:00 to 04:00, from the time given or the time of logging) counts as a trigger automatically, so it isn't asked.

Habits created before this change keep their questions; "Use recommended" in You switches them over (with undo).
