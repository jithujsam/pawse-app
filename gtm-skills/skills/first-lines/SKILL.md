---
name: first-lines
description: Write researched, non-generic first lines for cold emails, one per lead, grounded in a real public fact about the prospect or company, with the source saved. Use when the user asks for personalisation, icebreakers, custom first lines, personalised openers, or wants to replace Clay AI columns for personalisation.
---

# First Lines

Goal: a first line that proves you looked, ties to the pain, and could not be sent to anyone else.

## Process (per lead)
1. Find one specific, recent, public fact. Priority order:
   1. A trigger tied to the offer (hiring the role, launch, funding, expansion, migration)
   2. Something the person said or wrote (post, podcast, talk, blog)
   3. A specific company detail (new market, customer win, product page change)
2. Write the line: observation → implication. Max 20 words.
3. Save `first_line, first_line_source_url, fact_type` to the CSV.

## Good vs bad

| Bad (generic) | Good (specific) |
|---|---|
| "Love what you're doing at Acme!" | "Saw Acme is hiring 3 SDRs in Austin; ramping them usually stalls on list quality." |
| "Congrats on your recent success." | "Your Series A note said EU expansion is next; outbound to Germany is a different game." |
| "I came across your profile." | "Your podcast take on killing MQLs was blunt; most RevOps leads won't say that publicly." |

## Rules
- No flattery words: love, impressed, amazing, great, congrats (unless the event is real and named).
- Never invent a fact. If nothing specific is found, write `NO_FACT` and leave the line empty; those leads get a non-personalised variant.
- Do not mention things that feel invasive (family, personal life, location tracking).
- Facts older than 6 months are weak; flag them.
- Batch work: for 50+ leads, do 10, show the user, adjust tone, then continue.
