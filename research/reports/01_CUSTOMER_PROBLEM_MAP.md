# Customer problem map (deliverable 2)

Evidence base:
- 80 verified quotes from 79 distinct authors: Reddit via an archive (19 threads), Capterra (7 products) and Hacker News (2 threads).
- 41% of the quotes are counter-evidence.
- Full quotes and source URLs are in `generated/CUSTOMER_EVIDENCE.md`; cluster tables are in `generated/CLUSTERS.md`.

**What this sample can and cannot show.** It shows which problems exist and how people describe them. It cannot show how
common they are. Reddit comment search failed throughout, so threads were found by title and post text, which biases the
sample towards people asking questions. Capterra pages favour positive reviews.

## Problems by workflow area

| Area | What breaks | Who | Today's workaround | Consequence | Key evidence | Against |
|---|---|---|---|---|---|---|
| **L. CRM data entry & sync** | Every email or call creates an update obligation (stage, next step, close date, task). Manual logging decays within weeks. | AEs, small-team reps, founders | End-of-day batch updates; copy-paste from AI notetakers; BCC to Salesforce | Pipeline nobody trusts; time spent "managing the CRM rather than selling" | E10, E14, E19, E34, E39, E45, E63, E75 | E13 ("ctrl+c ... isn't that big of a heartache"), E8, E40 (Streak/Copper inside Gmail already log automatically) |
| **F/L. Thread ↔ deal association** | One company with several open deals and overlapping contacts: emails attach to the wrong deal. | Small teams on HubSpot | Confirm the deal by hand on each new thread | Misleading deal timelines | E63, E64, E48, E49 | E47, E40 |
| **C. Follow-up scheduling** | A "circle back in two weeks" lives in someone's head. | Founders, consultants, local-service SMBs | Scheduled send, fixed follow-up days, task reminders | Lost deals: E27 found the client had signed elsewhere; in E28 the customer had already gone with someone else | E27, E28, E19, E22, E23, E72 | E25, E26, E24, E50 |
| **H. Stalled deals** | Quotes and proposals go quiet with nobody noticing. | Same as above | Memory | Lost deal | E27, E28 (only 2 voices) | — |
| **J. Manager visibility** | Managers chase verbal or spreadsheet updates despite the CRM. | AEs at larger companies | Forecast-call spreadsheets | Duplicate reporting | E15, E16, E70 | E41 |
| **F. Tool sprawl** | Sales context spread across Gmail, Notion, Slack, Zapier and a CRM. | Small teams | Zapier glue; extra tools | Cost and complexity | E1, E32, E74, E70 | E30, E80 |
| **M. Permissions** | IT refuses inbox integrations; owners are uneasy granting full email access. | Mid-size and enterprise | Do the work manually | The product cannot be adopted | E11, E12, E20, E65, E76, E60 | none found, and none from small-team owners either way |
| **M. Cold-email deliverability** | Domain reputation, sending infrastructure | Agencies, outbound teams | Instantly / Smartlead + many mailboxes | $250-$2,000/month of spend | E52, E53, E54, E9 | E55 |
| **D, E, G, I, K** | Inbox triage, reply classification, proposals, handoffs, promises | — | — | — | Thin: E17, E58, E77 | E78 |

### The strongest counter-pattern

32 voices say simple tools or habits are enough. Examples:
- Excel or Obsidian: E56, E57, E58, E62.
- Free HubSpot: E21.
- Pipedrive at about $60/month for 4 people: E37.
- A CRM is "not useful at all until we got over 20 customers": E35.
- It's "a workflow problem disguised as a tooling problem": E61, E31, E33.

This is the main reason the broad concept is not supported. A large share of the target users does not experience the problem as one that software should fix.

## Ranked problems (smallest, most expensive, most frequent)

| Rank | Problem | Frequency | Cost signal | Independent first-hand voices for / against | Solvable on its own? |
|---|---|---|---|---|---|
| 1 | Keeping the CRM current from email: stage, next step, follow-up task, right deal | Daily (E14) | Indirect: rep time; distrust of the pipeline (E63) | 15 / 3 (data entry) + 7 / 3 (association) | Yes, as a companion to the existing CRM |
| 2 | Forgotten follow-ups on live opportunities | Weekly (**inference**) | Direct but anecdotal: lost deals (E27, E28) | 9 / 4 | Yes, but free substitutes exist (Gmail nudges F141, scheduled send E25) |
| 3 | Manager visibility without chasing reps | Weekly (E15) | Time | 4 / 1 | Mostly a by-product of #1 |
| 4 | Cold-email infrastructure | Daily | Highest cash spend (E52, E53) | 5 / 1 | Excluded: needs ESP-style infrastructure and violates provider policy for connected mailboxes |

## Willingness to pay

- **Payments observed:** none for the proposed product.
- **Existing spend:**
  - CRMs (E37, E51, E70, E30).
  - Inbox tools: one consultant paid for Superhuman on day 5 to stop missing emails (E77).
  - Cold-email infrastructure (E52-E54).
- **Price churn:** E7 (Streak too expensive), E71 (Close), E43 (HubSpot seat packaging).
- **Stated willingness to pay:** only for human help with a CRM (E6). This weakly suggests that a *service* may sell where software does not.
