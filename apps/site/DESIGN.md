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

## 3. Direction (v2, 2026-11-02)

The first version ("The product performs": white, black, one blue, Schibsted Grotesk) was rejected by the owner:
it didn't feel like PAWSE. The brief is now **a website that matches the vibe of the app**.

Re-dealt with the Taste Skill, keeping the app's palette and type
(`draw.mjs --keep palette,type --tone playful --have product-ui,illustration --options 3`):
`loud-flat-poster`, `borrowed-category`, `page-is-the-object`.

**Chosen: `page-is-the-object`.** Its idea is to build the page as the artefact that already exists in the
subject's world. For PAWSE that artefact is the app itself, so the page is built from the app's own parts. The
dealt stationery blueprints (menus, receipts, index cards) were not used: the app's components replace them.

## 4. The idea

> On this page, **Miso's room (the pet page, whose sky follows the pet's wellness)** becomes **the page itself**.

- **Hero:** the app's pet page at web scale, copied from `apps/web/src/styles.css`: the golden sky of a thriving
  pet, the sun and motes, the serif greeting and name, the small caps line, the live 3D dog (tap to pet), a
  speech bubble, four round vitals (here they link to sections), the 20-segment health bar and two pill actions.
- **Below:** the app's cream ground and white 24px cards with a soft line, pill buttons, chips, the Missions
  sheet with its handle, the app's list rows for the FAQ, and its toast for the checkout notice.
- **The live thing:** "Try the 21 days" is a Missions sheet over a room. Its weather comes from the app's
  `sceneFor()` (`apps/web/src/scene.ts`), driven by the real mission engine: a storm on day 0 of a rescue,
  overcast as it heals, the storm back after a slip (with tears), golden when it thrives. The dog takes the
  room's light.
- **Close:** the same room at night, with the moon and stars: "Someone to come back to".
- **Fonts:** Geist and Newsreader, the app's own (`@fontsource-variable/*`, already in the lockfile).

## 5. Taste Skill rules turned off, and why

The app's brand uses things the skill's house style bans. The owner asked for the app's vibe, so these are
allowed for this page only, and every source line carries a `taste-skill-ignore` note:

| Rule | Why |
| --- | --- |
| gradient | The room's sky, sun and night are the app's signature. |
| palette-cream, palette-terracotta, palette-claude | The app's cream ground and the dog's amber accent. |
| all-centred | The app's screens are centred. |
| micro-label | The small caps line under the pet's name, as in the app. |
| outlined-box, hairline | The app's cards have a 1px soft line; its list rows are divided by one. |
| shadow | Only the moon's glow, as in the app. |
| icon-cards | The three stage cards use the app's round icon style. |

## 6. Gate results (final)

- `lint.mjs`: 0 FAIL, 5 WARN (outlined boxes: the app's cards).
- `inspect.mjs` with the allowances above: **0 FAIL, 4 WARN** at 1440, 768 and 390. Output and screenshots are
  in `design/inspect/`.

WARNs, defended: *mixed-font-headline* (a serif pet name beside a sans chip, as in the app); *size-count* (the
app's own scale); *grey-body* (the app's muted secondary text, 6.3:1); *no-footage* (the moving picture is the
live 3D dog).

Fixed in the look rounds: the hero dog rendered at full width (CSS order), gaps in the cards grid, 20px of
phone overflow from the rotated phones, the moon over the closing heading on phones, light text on the cream
end of the stormy demo sky (1.1:1, now the whole stage takes the weather colour), the inactive "Raise" segment
at 4.2:1, and no action on the first phone screen.
