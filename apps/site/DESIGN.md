# PAWSE landing page: design notes

Working notes for the public marketing page in `apps/site`, written before the markup, following the
Taste Skill run (`.claude/skills/design-taste-frontend`). The direction sheet itself is
`apps/site/design/direction.json` (copied from `.taste-skill/direction.json`).

## 1. Inventory: what only PAWSE has

Facts checked against the code on 2026-11-02 (app 5.0.19, code 79).

1. **A real, rigged 3D Shiba Inu** (`apps/web/public/models/dog.glb`, Quaternius, CC0) with a face rig built
   in code: eyelids, brows, tears, tongue, ear and tail posing (`apps/web/src/Pet3D.tsx`).
2. **Its real clips:** Idle, Idle_2 (waiting), Idle_2_HeadLow (sad/sick), Jump_ToIdle (happy hop),
   Idle_HitReact_Left/Right (hurt, petted), Death (only with the opt-in classic rules; never shown on this page).
3. **Visible conditions per trait** (`petTraits()` in `packages/engine/src/missions.ts`): a rescued dog's coat
   dulls, its head lowers, its ears flatten, its tail stills, it looks away; each trait comes back as its own
   condition heals. Used only for Rescue in the app (`Home.tsx` passes `condition` for rescues only).
4. **The number 21** and the heal days **1, 3, 6, 10, 15, 21**.
5. **Rescue (harder):** six conditions, mildest first: Itchy, patchy coat · Low energy · Startles at noises ·
   Doesn't know how to play · Afraid of being left alone · Afraid of people.
6. **Raise (easier):** six skills on the same days: Learns its name · Settles into a routine · Plays fetch ·
   Explores with confidence · Stays calm alone · Grows strong.
7. **Wellness W:** rescue starts at 10 and climbs to 100 over 21 days; raise starts at 70.
8. **After recovery a slip makes an issue, not a restart:** upset stomach / restless nights / itchy patch (3 days
   in a row to clear), old fear returns (7), withdrawn (14). Then 21 days of consistency (rewards at 7, 14, 21:
   "One week strong", "Two weeks strong", "Fully consistent"), then thriving ("Month n thriving" every 30 days).
9. **The phrase "A slip is information, not a verdict"** (README) and the three Voices: Gentle, Honest, Direct.
10. **Five day states:** goal met, slip, urge managed, not tracking, not recorded ("unknown, never a failure").
11. **Habits people actually name in onboarding:** late-night food orders, impulse buys, smoking, vaping,
    doomscrolling, drinking, or anything they type.
12. **Privacy facts:** no ads, no trackers, no analytics, no public profiles; row-level security; photos never
    leave the phone; optional PIN encrypts what is stored on the phone; export or delete everything.
13. **Distribution:** an Android APK on GitHub (`jithujsam/pawse-releases`), version 5.0.19. No public web app.

## 2. The argument (one claim per section, with its proof)

1. PAWSE gives a habit a face: a dog whose wellbeing follows your check-ins. → the live 3D dog, first screen.
2. Numbers are easy to look past; a companion is not. → lead paragraph + four plain answers.
3. You choose how it starts: rescue a dog that needs healing, or raise one that needs teaching. → two real dogs
   side by side, the six conditions and six skills mirrored on the same six days.
4. The 21 days are real rules you can try here. → live demo running the app's own engine.
5. After 21 days it does not end: consistency, then thriving, and a slip becomes an issue, not a restart. →
   the real Missions screens, one statement per stage.
6. The daily loop takes seconds. → four fields: check in, record, the dog responds, review.
7. Around the dog are real tools. → command list: Journey, Insights, Urge support, Several habits, Your plan,
   Weekly review, each with its real screen.
8. It is honest about what it is. → facts + plain paragraph: not treatment; private by default.
9. Founding access costs $1 or $3, once. → the two passes in a table.
10. Answers to the real questions. → FAQ.
11. Close on the dog again. → the dog returns with the one action.

## 3. Direction

Dealt three (`draw.mjs --options 3`, sector consumer-app, seed 1830912445):
`quiet-instrument`, `product-performs`, `name-as-monument`.

**Chosen: `product-performs` ("The product performs").** PAWSE's product *is* the companion responding to your
days, and that response is already software we own: the same model, the same `petTraits()` and the same
`journey()`. A page whose idea is "put the working product in front of the visitor" lets the dog itself make
the argument. `quiet-instrument` would have whispered a product whose point is emotional presence;
`name-as-monument` would have made the wordmark the hero when the hero must be the dog.

Redraws, with reasons:
- **Hero** redrawn once: the dealt "Column on one line" leaves the right half blank and shows only 90px of the
  demo; the brief requires the actual companion to dominate the first screen. New hero: "Sentence split by a
  frame". Kept.
- **about** → `about-side-facts-wide-paragraph`: the dealt founder's letter would have to be invented.
- **cta** → `cta-object-returns`: the dealt "sentence with a blank" is an email form, and there is no form
  backend. The dog returning is the honest close.
- Palette kept ("Sheet and biro": white, near-black, one blue). The dog is golden; the blue action is its
  complement, and it keeps the page clear of the app's cream-and-terracotta (a house-rule tell).
- Type kept (Schibsted Grotesk 400/600/800, self-hosted). The app keeps Geist/Newsreader; the page is its own
  art direction and the product stays recognisable through its screens and its dog.

Added outside the dealt list, built in this direction's manner: **Rescue or raise** (two dogs, one shared
column of heal days) and **Stages** (a pinned Missions screen that changes under three statements, which the
direction's composition asks for: "One section pins a fragment while three short statements change it").

## 4. The idea

> On this page, **the 21-day mission and the dog's own conditions** become **a working fragment of the product:
> the real dog, driven by the real engine, that you look after yourself.**

Competitor test: another habit tracker has a streak, not a rescued dog whose coat dulls and whose trust is the
last thing to heal on day 21. The sentence fails for them.

**The live thing:** the "Try the 21 days" panel. Choose Rescue or Raise, press *Goal met* or *Slip*, or drag to
any day. The dog, its wellness, its six conditions or skills, the stage and any post-recovery issue all come
from `journey()`, `wellness()` and `petTraits()` in `@detox/engine`, the same functions the app runs. Works by
thumb; without script or WebGL the panel shows the still render and the rules as text.

## 5. Copy deck

Headlines ≤ 2 lines at every width. No eyebrows, no numbering. Sentence case.

**Nav:** PAWSE · How it works · Rescue or raise · Founding passes · FAQ · [Become a founding user]

**Hero (h1, split around the dog):** "Every good day" / "helps it heal."
Supporting: "PAWSE is a habit-change app for Android. Pick a habit you want to change, adopt a dog, and check in
each day. How you're doing shows in how it's doing."
Action: **Become a founding user** → #founding. Text link: Try the 21 days →  #try

**Intro (no heading in the blueprint; house rules add one):** heading "Numbers are easy to ignore".
Lead: "A streak counter tells you a number. It doesn't look up when you come home. PAWSE puts a companion where
the number was, so the habit you're changing has a face, and a slip has a cost you can see but never a verdict."
Four columns:
- **Who it's for.** Anyone who wants to change something they keep doing: late-night food orders, impulse buys,
  doomscrolling, smoking or vaping, drinking, or a habit you name yourself. You set the goal: stop, cut down, or
  understand it first.
- **What it is.** An Android app with a 3D companion at its centre. Each day you record a goal-met day, a slip,
  or an urge you got through. Your companion's wellness, mood and missions follow those records and nothing else.
- **How it treats slips.** A slip is information, not a verdict. Your companion feels it, your record keeps every
  good day, and the app shows exactly what puts it right. You pick how it talks to you: Gentle, Honest or Direct.
- **What it isn't.** Not therapy, not medical treatment and not a promise. It's a self-awareness tool that makes
  your days visible. It never tracks calories, weight or food restriction.

**Rescue or raise:** heading "Rescue it or raise it".
Sentence: "When you adopt, you choose where your dog starts. Both take 21 goal-met days in a row; the difference
is what those days do."
- Rescue (harder): "A neglected dog with six conditions. Each goal-met day in a row brings it closer to well;
  a slip starts the 21 days over." Wellness starts at 10.
- Raise (easier): "A healthy young dog with six things to learn. The same 21 days teach it, and it starts at 70
  wellness, so a slip slows it rather than hurting it."
- The shared column: Day 1 · 3 · 6 · 10 · 15 · 21, conditions on the left, skills on the right.
- Note: "These describe your dog, not you."

**Live demo:** heading "Try the 21 days".
Sentence: "This is the app's own mission engine. Look after a dog for a few weeks and watch what each day does."
Controls: Journey [Rescue | Raise] · Goal met · Slip · Day (slider 0–42) · Start over.
Readouts: "Day 8 of 21 · best run 8", "13 goal-met days to go", stage name, wellness %, now healing / healed.
Under the panel: "Nothing here is saved. It runs on this page only."
No-JS / no-WebGL fallback: still render + "Rescue: wellness starts at 10 and reaches 100 on day 21…".

**Stages:** heading "21 days, then 21 more".
- Recovery. "Goal-met days in a row. Six conditions heal on days 1, 3, 6, 10, 15 and 21. A slip starts the
  count over, but your best run is kept."
- Consistency. "Once recovered, 21 more goal-met days make it last, with rewards at one week, two weeks and
  three. A slip now gives your dog an issue to clear, never a restart."
- Thriving. "After that, a reward every 30 well days. An issue from a slip clears with 3, 7 or 14 goal-met days
  in a row, depending on how often slips came."
Footnote: "21 days is PAWSE's mission length, not a medical recovery time."

**Daily loop:** heading "A day with PAWSE".
- "First, you check in." (the check-in menu)
- "Then say how it went." (goal met, slip, or an urge you managed)
- "Your dog responds." (the pet page)
- "And the days add up." (Journey calendar)
Closing line: "Tomorrow, the same. Most check-ins take a few seconds."

**Tools (command list):** search placeholder "Find a tool".
- Urge support — "Pause, name what's going on, and pick a way through: breathe, change where you are, add
  friction, reach out. Switch whenever one isn't helping."
- Journey — "A calendar of your days, your milestones, and the last four days to fill in or correct."
- Insights — "This week against last, urges you got through, your riskier hours and the money you kept."
- Several habits — "Each habit gets its own companion, records and progress. Nothing on one changes another."
- Your plan — "Your reasons, hard moments and first step, shown back to you when an urge comes."
- Weekly review — "What helped, what was hard, and one change for the week ahead."
- Home-screen widgets — "Your pets on the Android home screen, each in today's mood. Tap to check in."

**About (honest expectations):** heading "What PAWSE is, and isn't".
Facts: Platform — Android beta (5.0.19) · Price today — Founding passes, $1 or $3 once · Data — Private to your account.
Paragraph: "PAWSE is a self-awareness and habit-change tool. It is not medical treatment, therapy or a cure, and
the dog's conditions are illustrative. If a habit is hurting you, talk to a doctor or someone you trust; the app
shows a crisis line when it hears words that need one. Stopping alcohol suddenly can be dangerous for some
people."
Lists: **Private by default** — Account data protected by row-level security · Photos never leave your phone ·
No ads, no trackers, no analytics · Optional PIN encrypts what's stored on the phone · Export or delete
everything, any time. **Never** — Calorie, weight or restriction tracking · Public profiles · An AI key inside the
app · Shame as a feature.

**Pricing:** heading "Founding passes".
Supporter Pass — $1 one-time: Android beta now · Founding supporter recognition · Free account tier at public
launch · Future premium features: Not included.
Beta Pass — $3 one-time: Android beta now · Founding supporter recognition: (not stated in brief → "Not stated")
→ decision: rows only list what each pass states. Rows: "Current Android beta" · "Founding supporter
recognition" · "Free account at public launch" · "Premium beta" · "Future premium beta features".
Note: "Premium beta features are planned, not available yet. Your 90 days start when they arrive, not when you
pay." Checkout status: "Checkout isn't open yet. Passes go on sale when payments are connected."

**FAQ:** heading "Questions".
(Answers in the page source; each limited to what the code supports.)

**CTA (dog returns):** heading "Someone to come back to". Sentence: "Pick a habit, adopt a dog, and start day one."
Fact: "Founding passes from $1, once." Button: Become a founding user.

**Footer:** "PAWSE, a habit-change app with a dog in it" · Rescue or raise · Founding passes · FAQ · Releases ·
"© 2026 · Privacy" (privacy anchors to the about section) · model credit "3D dog by Quaternius (CC0)".

## 6. Sample or unconfirmed content (for the owner)

See the final report; repeated in `apps/site/README.md`.

## 7. Look rounds (Taste Skill step 8)

Inspector: `design/inspect/inspect-output.txt` (final: **0 FAIL, 1 WARN**), screenshots at 1440, 768 and 390 in
`design/inspect/`. Lint: 0 FAIL, 0 WARN.

Round 1 (0 FAIL, 4 WARN), fixed:
1. Hero: the top screenshot peek ran under the nav, and "Every good day" orphaned "day" → reel starts below the
   nav, frame narrowed to 30vw, headline kept on one line per half and sized from the side column.
2. Ten type sizes → five tokens (small, body, lead, head; the hero takes the head step capped by width).
3. The intro statement ran to four lines → cut to 27 words, three lines.
4. Margins measured 32/48 → table and paragraph blocks run to the right margin.

Round 2 (1 FAIL), fixed: the enlarged dogs overlapped the Rescue/Raise titles and the closing heading → each
dog is clipped to its own box. Phone: halves now flush to their own edges, intro is one column, the screenshot
slivers are hidden (they read as stray bars), the demo dog sits in the same box as the others.

Round 3, fixed: at 1200px the headline touched the frame (found in the OG render) → `min(head, 4.8vw - 8px)`;
clearance measured ≥ 26px from 900 to 1920px.

Remaining WARN, defended: *no video*. The page's moving picture is the app's own animated 3D dog (four live
instances). A stock clip of a dog would show something PAWSE isn't.

Critique (references/critique.md, honest): the first screen reads in five seconds (what it is, what to do, the
dog); the live demo is the strongest moment and uses real rules. Weakest: the Rescue/Raise dogs differ subtly
at page size (coat, head turned away), so the mirrored day table carries most of that comparison; the stages
section leaves white space beside the pinned screen between statements on short desktop windows; the about row
is quieter than its neighbours.
