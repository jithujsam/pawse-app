---
name: clay-migration
description: Rebuild a Clay table or enrichment workflow as a Claude Code workflow (scripts plus skills) that runs on cheaper or free data sources, with a cost comparison. Use when the user mentions Clay credits, Clay pricing, a Clay table, waterfall enrichment, AI columns, or wants to cut enrichment costs or move a GTM workflow out of Clay.
---

# Clay Migration

Goal: same output columns as the Clay table, lower monthly cost, and a workflow the team owns in their repo.

## Inputs
Ask for one of:
- A Clay table export (CSV) plus a description or screenshot of each column, or
- A written list of columns: name, type (input / enrichment provider / AI prompt / formula), and the provider or prompt used.

Also ask: rows per month, current Clay plan, and which providers they already pay for (Apollo, Hunter, Prospeo, an LLM API key, etc.).

## Process
1. **Map every column** into one of four buckets:

   | Clay column type | Rebuild as |
   |---|---|
   | Input / import | CSV in the repo |
   | Formula | Python in a script |
   | AI column (prompt) | A skill or prompt run by Claude Code (or the team's own LLM API key) |
   | Enrichment provider / waterfall | Direct API call to a provider they already pay for, free source from `lead-sourcing`, or `email_guess.py` + verifier |

2. **Flag what does not migrate cleanly**: providers only available through Clay, real-time webhooks, CRM sync. Be honest; some teams should keep Clay for those columns.
3. **Write the workflow**: a `workflows/<table-name>/` folder with a README, the scripts, and a run command. Use the team's own API keys from environment variables, never hard-coded.
4. **Cost comparison** table: current Clay cost per month vs. new cost (API calls × price + LLM cost). Show the assumptions.
5. **Test on 20 rows** and compare against the Clay output column by column before calling it done.

## Output
- Column mapping table
- Workflow files
- Cost comparison with assumptions
- What stays in Clay (if anything) and why
