---
name: icp-builder
description: Turn a company's website URL into a sharp ideal customer profile (ICP), buyer personas, pains, triggers and ready-to-paste search filters for free sources (LinkedIn search, Apollo free tier, Google, job boards, Google Maps). Use when the user gives a website or product and asks who to sell to, who to target, to build an ICP, define personas, or start an outbound campaign from scratch.
---

# ICP Builder

Goal: from one URL, produce an ICP precise enough that two different people would build the same lead list from it.

## Inputs
- Website URL of the company that is *selling* (required)
- Optional: existing customer names, case studies, deal size, geography limits

If the user gives only a URL, do not ask questions first. Research, draft, then list the assumptions they should confirm.

## Process

1. **Read the site.** Fetch the homepage, pricing, customers/case studies, about, and 1-2 product pages. Note: what it does, price point, named customers, integrations, claims.
2. **Infer the buyer from evidence, not imagination.**
   - Named customers and logos → their industry, size, geography.
   - Pricing → company size that can afford it (rule of thumb: annual price should be < 1% of the buyer's revenue for an easy yes).
   - Integrations → the tools the buyer already uses (these become targeting signals).
3. **Pick ONE primary segment.** Choose the segment with the clearest pain and the easiest list to build. List 1-2 secondary segments, but the campaign targets one.
4. **Find triggers.** Events that make the pain urgent now: hiring for a role, new funding, new leader, tool migration, expansion, compliance deadline, bad reviews. Every trigger must be something you can *find* in public data.
5. **Write the filters** for every free source in the table below.

## Output format

```
## ICP: <one line>
Company: industry | headcount | geography | revenue band | tech used
Not a fit: <explicit exclusions>

## Personas
| Persona | Title keywords | What they own | Pain in their words | What they'd measure |

## Triggers (why now)
| Trigger | Where to find it for free | Why it signals pain |

## Search filters
- LinkedIn search (free): titles + keywords boolean string
- Apollo free tier: industry, headcount, location, technologies
- Google: site: / intitle: dork queries that surface matching companies
- Job boards: job titles whose posting signals the pain
- Google Maps (local businesses only): category + city queries

## Assumptions to confirm
- <numbered list>
```

## Rules
- Use the buyer's language, not the seller's. "Our pipeline is dry" beats "suboptimal lead velocity".
- No segment called "SMBs" or "startups". Name the industry and size.
- If the evidence is thin, say so and lower confidence; do not invent customers.
- Hand off: suggest running `lead-sourcing` next with these filters.
