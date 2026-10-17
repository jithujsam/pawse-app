---
name: cold-sequence
description: Write a 3-email cold outbound sequence (plus subject lines and A/B variants) that follows deliverability-safe, reply-focused rules, formatted for import into Instantly, Smartlead or any mail-merge tool. Use when the user asks for cold emails, an outbound sequence, follow-ups, email copy, a campaign, or to rewrite emails that are not getting replies.
---

# Cold Sequence

Goal: short emails a busy buyer reads on a phone and can answer with one word.

## Inputs
- ICP and persona (from `icp-builder`)
- Offer: what they get, the proof, the ask
- Whether `first-lines` were written (use `{{first_line}}` if yes)

If there is no proof (case study, number, named client), say so and use a low-risk ask instead of inventing proof.

## Structure

**Email 1 (day 0)**: 50-90 words
1. `{{first_line}}` or a pain observation for the segment
2. The problem in their words, one sentence
3. What you do + one proof point
4. A low-friction ask: interest question, not a meeting ("Worth a look?", "Open to seeing how?")

**Email 2 (day 3)**: 30-60 words, same thread
- New angle: a different pain, a mini case study, or a useful resource. Never "just bumping this".

**Email 3 (day 7)**: 20-40 words, same thread
- Polite close-out that makes "no" easy. Optionally point to someone else on their team.

## Subject lines
2-4 words, lowercase, looks internal: `sdr ramp`, `eu outbound`, `question about {{company}}`. Give 3 options for A/B.

## Deliverability rules (non-negotiable)
- Plain text. No images, no attachments, no tracking pixels in email 1 if possible.
- Zero or one link, never in email 1.
- No spam words: free, guarantee, act now, limited time, $$$, 100%, risk-free.
- Spintax or 2 variants per email for volumes above ~50/day per inbox.
- Merge tags: `{{first_name}}`, `{{company}}`, `{{first_line}}` with fallbacks.

## Output
1. The sequence as readable text with word counts.
2. A CSV block ready for import: `step, delay_days, subject, body` (A and B variants as separate rows).
3. Three reasons this might fail with this ICP and what to test first.
