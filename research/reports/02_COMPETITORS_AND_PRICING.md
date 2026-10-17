# Competitors, substitutes and pricing (deliverables 3 and 4)

Evidence base:
- 24 products and 121 vendor-document facts. 119 are verified against saved pages; Pipedrive pricing (F172) and one Apollo fact rest on search snippets only.
- The full matrix with a fact id per cell is in `generated/CAPABILITY_MATRIX.md`; prices are in `generated/PRICING.md`.
- `?` in the matrix means *not verified*. It does not mean the product lacks the feature.

## Positioning summary

USD per user per month on annual billing, unless noted.

| Product | Buyer / core job | Works inside the inbox? | Entry price for pipeline + automated follow-up | Overlap with the hypothesis |
|---|---|---|---|---|
| Gmail (+ Gemini) | Everyone / email | Native | n/a: no deals, no sequences (F141-F143) | Nudges for forgotten replies and follow-ups (F141), AI drafts (F143) |
| Outlook (+ Copilot) | Everyone / email | Native | n/a | Prioritise (F146), manual follow-up flags (F148) |
| HubSpot | SMB → mid-market CRM | Gmail extension / Outlook add-in (F155) | Free CRM has a pipeline (F153, F154); sequences need Sales Hub Professional (F149): Sales seat $100 (F100) | Free pipeline + inbox logging; replies unenrol contacts from sequences (F150); credit-metered AI agents (F101, F156) |
| Streak | Gmail teams | Yes, Gmail only (F84) | Pro $49 (F77) | Deals in Gmail, email history auto-linked, "last reply" / "time in stage" fields (F80), follow-ups exclude repliers (F186), tasks (F81) |
| folk | Founders, agencies | No | Premium $48 for sequences + deals (F102) | Follow-up Assistant spots stalled email threads with a pending next step and pre-writes the follow-up (F179) |
| Close | Founders / SMB sales | No | Growth $99 for workflows (F87) | Suggested Actions on stalled deals (F89), task inbox (F90), two-way sync (F88), AI drafts (F91) |
| Copper | Google Workspace SMBs | Yes, Gmail (F138) | Prices unreadable (F140) | Gmail-native CRM; next-step suggestions (F139) |
| Day.ai | AI-native CRM | No | Professional $60/"agent" (F134) | Builds CRM memory automatically from Gmail (F135); drafts follow-ups (F136) |
| Lightfield | Founders | No | Starter $89 monthly (F163) | CRM records updated automatically from email (F164) |
| Clarify | Very small teams | No | $40/mo for up to 3 users (F193) | AI creates deals, updates fields and creates tasks (F194) |
| Pipedrive | SMB pipeline CRM | No | ~$39 Growth (F172, **unverified**) | Sequences on deals (F173); AI suggests when to follow up (F174) |
| Attio | Startups → scale-ups | ? | Plus $35, Pro $79 (F96) | Email sync to records, sequences |
| Superhuman | Power emailers | It *is* the client | Business $33 (F168) | Automatic follow-up reminders + drafted follow-ups (F166); no pipeline (F169) |
| Mixmax / Yesware | Sellers in Gmail | Yes | $29 / $35 (F106, F109) | Sequences stop on reply; no pipeline |
| Instantly / Smartlead / Saleshandy / Apollo | Cold outbound | No | $47/mo, $39/mo, $34/user, $49/mo (F118, F122, F125, F111) | Own sending infrastructure / mailbox rotation; the excluded use case |
| Salesloft / Outreach / Salesforce | Mid-market → enterprise | No | Quote only (F158, F161); Salesforce Pro Suite $100 (F132) | Deal-risk signals and AI agents for larger teams |
| Front | Shared-inbox support teams | No | $25 (F128) | Not a sales tool |
| Zoho Bigin | Micro-businesses | No | $7 (F189) | Cheap pipeline with email integration |

## What job would we do substantially better?

**No single capability in the hypothesis is new.** Each piece exists today:
- Deal context inside Gmail: Streak.
- Stalled-thread follow-up drafts: folk, Superhuman, Gmail nudges.
- Stalled-deal suggestions: Close.
- Auto-CRM from the inbox: Day.ai, Lightfield, Clarify.
- Sequences that stop on reply: HubSpot, Streak, Mixmax.

A new interface or another collection of AI features would not be enough to stand out.

The only gaps the verified facts leave open are narrow:

1. **No migration.** Every auto-CRM above asks the team to *replace* their CRM. Teams that already pay for and
   report from HubSpot or Pipedrive (E37, E39, E51) can't use them without switching. A companion that keeps *their* CRM current is
   not offered by any product verified here. HubSpot's own credit-metered agents (F101, F156) are the obvious threat,
   and how accurate they are on deal updates is **unknown** (`native-crm-ai-overlap`).
2. **Price below HubSpot Pro.** HubSpot puts sequences behind Professional (F149, Sales seat $100, F100). Close puts
   automated workflows behind Growth at $99 (F87).
3. **Outlook.** The inbox-native deal tools found (Streak, Copper) work with Gmail only (F84, F138). folk covers Microsoft mail,
   but in a separate app (F179).

These are gaps in packaging and price, not in technology. An incumbent can close them by bundling (risk `incumbent-bundling`).

## Evidence of switching and dissatisfaction (customer side)

| Direction | Evidence |
|---|---|
| Away from big CRMs on price/complexity | E29, E30 ($800/mo saved leaving Salesforce), E43 (HubSpot seat minimums → Pipedrive), E45 (HubSpot "daily update of the data was grueling") |
| Away from light tools as needs grow | E1 (outgrew Streak), E36 (Notion/Airtable broke at ~50 leads), E44 (Excel → Pipedrive) |
| Satisfied, no switch intended | E37 (Pipedrive), E40 and E47 (Copper in Gmail), E73 (Close), E21 (HubSpot free) |
| Inbox tools judged redundant | E78 ("Gmail has improved enough that Superhuman is redundant") |
