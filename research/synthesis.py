#!/usr/bin/env python3
"""Analyst layer: writes findings/ws5-synthesis.jsonl (hypotheses, scores, risks, unknowns, experiments, gates).
Edit this file, then run it and `rdb.py build && rdb.py render`. Every score cites refs or states its basis."""
import json
from pathlib import Path
OUT = Path(__file__).resolve().parent / "findings" / "ws5-synthesis.jsonl"
R = []
add = R.append
add({"kind": "run", "id": "ws5-synthesis", "phase": "synthesis", "workstream": "synthesis", "agent": "lead",
     "notes": "Analyst interpretation: hypotheses, scores, gates, experiments. Every score cites refs or is marked inference/unknown."})

def hyp(slug, htype, title, statement, status="open", rejection=None, scores=()):
    add({"kind": "hypothesis", "slug": slug, "htype": htype, "title": title, "statement": statement, "status": status,
         "rejection_reason": rejection})
    for crit, score, basis, why, refs in scores:
        if basis == "unknown":
            score = 1  # METHOD.md: missing evidence is scored 1 so it never looks like a strength or a fatal flaw
        add({"kind": "score", "hypothesis": slug, "criterion": crit, "score": score, "basis": basis, "rationale": why, "refs": refs})

# ------------------------------------------------------------------ segments
I, F, U = "inference", "fact", "unknown"
hyp("seg-founder", "segment", "Founders doing their own B2B sales",
    "Solo or two-founder companies selling B2B by email.", "rejected",
    "Pain is real but episodic, and the segment is split evenly between those who want help and those for whom a spreadsheet, Obsidian or free HubSpot is enough; price-sensitive; several say a CRM adds no value before ~20-50 customers.",
    [("severity", 1, F, "Lost deals from forgotten follow-ups exist, but many founders say process, not tooling, is the issue.", "ws3-rd-opslayer-lost-client,ws3-rd-colasy-not-consistent,ws3-rd-foresythe-process-not-crm,ws3-rd-lommer-crm-useless-early"),
     ("frequency", 2, I, "Follow-up decisions are daily once outbound starts; spreadsheets break around 50 leads.", "ws3-rd-vatoho-notion-50-leads,ws3-rd-cowluver-sheet-out-of-hand"),
     ("existing_spend", 1, F, "Free tools dominate; one churned from Streak on price.", "ws3-cap-streak-aarone-price-churn,ws3-rd-okmud-hubspot-free-fine,ws3-hn-articsputnik-obsidian"),
     ("ability_to_pay", 1, F, "'You can't beat free on price.'", "ws3-rd-basicsonly-cant-beat-free"),
     ("reach", 2, I, "Founders are visible in public communities; reaching them is cheap but noisy.", ""),
     ("time_to_value", 2, I, "Value appears only once enough threads are open to forget some.", ""),
     ("tech_compliance_risk", 2, I, "Founder is usually the Workspace/M365 admin, so consent is self-serve; CASA still needed for Gmail reads.", "g-casa-annual-al,m-consent-managed-mail-excluded"),
     ("competition", 0, F, "Free HubSpot, Streak free, Gmail nudges and folk all reach this user.", "hubspot-pricing-free,gmail-cap-nudges,folk-cap-followup-assistant"),
     ("onboarding", 3, I, "One mailbox, one decision maker.", ""),
     ("solo_founder_fit", 3, I, "Easy to reach and sell to without a sales team.", ""),
     ("retention", 1, I, "Either outgrow (move to a full CRM) or stop selling; price churn observed.", "ws3-cap-streak-aarone-price-churn,ws3-hn-matchmike-outgrew-streak")])

hyp("seg-small-team", "segment", "Small B2B teams (3-10 sellers) that already pay for a CRM but cannot keep it current",
    "Head of sales or sales-led founder of a 3-10 seller B2B company on HubSpot (free/Starter/Pro) or Pipedrive; reps sell by email; the CRM is out of date and deal threads attach to the wrong deal.", "selected", None,
    [("severity", 2, F, "Manual logging collapses within weeks; wrong deal association; more time managing the CRM than selling.", "ws3-rd-appx-thread-to-deal-association,ws3-rd-questoid-wrong-deal,ws3-rd-raccoon-hubspot-inconsistent,ws3-rd-vegtwist-managing-crm"),
     ("frequency", 2, F, "Every customer email creates an update obligation; hygiene done in end-of-day batches.", "ws3-rd-marcushee-batch-hygiene,ws3-rd-appx-thread-to-deal-association"),
     ("existing_spend", 3, F, "Already paying for Pipedrive (~$60/mo for 4), HubSpot tiers, Close + Zapier, Mixmax + CRM.", "ws3-rd-armok-pipedrive-60,ws3-cap-hubspot-salesops-pricing,ws3-cap-close-teamlead-zapier,ws3-cap-mixmax-cmo-need-crm-too"),
     ("ability_to_pay", 2, I, "Has a software budget, but tool fatigue and per-seat pricing push back.", "ws3-cap-pipedrive-mktmgr-hubspot-seats,ws3-rd-slowpotential-saves-800"),
     ("reach", 1, U, "No channel tested; CRM app marketplaces are a plausible route but unverified.", ""),
     ("time_to_value", 2, I, "Backlog of out-of-date deals is visible on day 1 if historical threads can be read.", ""),
     ("tech_compliance_risk", 2, I, "Buyer is often the admin, so Microsoft admin consent is feasible; Gmail reads still need CASA.", "m-consent-managed-mail-excluded,g-rsv-server-assessment"),
     ("competition", 1, F, "Many are satisfied with Pipedrive/Close/Copper; AI auto-CRMs target the same buyer.", "ws3-rd-armok-pipedrive-60,ws3-cap-close-headsales-satisfied,ws3-rd-bluelobster-copper-gmail,dayai-positioning,lightfield-positioning"),
     ("onboarding", 2, I, "Needs CRM + mailbox connection per seat and a mapping of pipelines.", ""),
     ("solo_founder_fit", 2, I, "Team sale, but buyer is one person and deal sizes small.", ""),
     ("retention", 2, I, "If it writes into the system of record it becomes part of the weekly pipeline review.", "")])

hyp("seg-ae", "segment", "Individual account executives managing active opportunities",
    "AEs at companies large enough to have a mandated CRM and manager forecast calls.", "rejected",
    "Strongest daily pain, but AEs rarely buy tools and corporate IT refuses inbox integrations; the buyer (sales ops/IT) is out of reach for a solo founder.",
    [("severity", 2, F, "Manual copy-paste from notetaker to Salesforce; managers chase verbal updates.", "ws3-rd-jiesen-notetaker-copy-paste,ws3-rd-hazard-verbal-updates,ws3-rd-mcburloak-manager-spreadsheet"),
     ("frequency", 3, F, "Daily batch hygiene.", "ws3-rd-marcushee-batch-hygiene"),
     ("existing_spend", 1, I, "Spend is the employer's, not the AE's.", ""),
     ("ability_to_pay", 0, I, "AE is not the buyer.", ""),
     ("reach", 2, I, "Easy to find, hard to sell to.", ""),
     ("time_to_value", 2, I, "", ""),
     ("tech_compliance_risk", 0, F, "IT gives a firm no to inbox integration; connecting Gmail is 'an uphill battle'.", "ws3-rd-freeart-it-firm-no,ws3-rd-clamjammin-gmail-it-uphill,ws3-rd-shibes-it-security-agent"),
     ("competition", 1, F, "Enterprise suites (Salesloft, Outreach, Salesforce) own this budget.", "salesloft-pricing-demo,outreach-pricing-quote"),
     ("onboarding", 0, F, "Blocked by IT before start.", "ws3-rd-shibes-it-security-agent"),
     ("solo_founder_fit", 1, I, "", ""),
     ("retention", 1, I, "", "")])

hyp("seg-sdr", "segment", "SDRs doing prospecting and cold follow-up",
    "Volume outbound through connected mailboxes.", "rejected",
    "Requires automated outreach to non-consenting prospects, which Google's developer policy and Gmail Program Policies prohibit for Gmail-connected apps; the segment's real spend goes to separate sending infrastructure (an ESP model we exclude).",
    [("severity", 2, F, "Deliverability and infra are real costs.", "ws3-rd-austin-1250-month,ws3-rd-tallest-2k-month"),
     ("frequency", 3, I, "", ""),
     ("existing_spend", 3, F, "$250-$2,000/month on domains, mailboxes, senders.", "ws3-rd-austin-1250-month,ws3-rd-tallest-2k-month,ws3-rd-cyberhouse-250-month"),
     ("ability_to_pay", 2, I, "", ""),
     ("reach", 2, I, "", ""),
     ("time_to_value", 2, I, "", ""),
     ("tech_compliance_risk", 0, F, "Gmail scopes not approved for apps distributing unsolicited commercial mail; app can lose API access for enabling user violations.", "g-gmail-no-spam-ucm,g-gmail-pp-no-ucm,g-udp-enforcement-enable-violation,m-exo-not-for-bulk"),
     ("competition", 0, F, "Instantly $47/mo unlimited accounts; Smartlead $39; Saleshandy $34.", "instantly-pricing-outreach,smartlead-pricing-base,saleshandy-pricing-plans"),
     ("onboarding", 2, I, "", ""),
     ("solo_founder_fit", 1, I, "", ""),
     ("retention", 1, I, "", "")])

hyp("seg-agency", "segment", "Small agencies managing clients' sales pipelines",
    "Lead-gen / outbound agencies running pipelines for several clients.", "rejected",
    "Under-sampled (3 items); visible spend is on cold-email infrastructure, i.e. the excluded use case; one agency built its own CRM.",
    [("severity", 1, U, "Only 3 evidence items.", ""),
     ("frequency", 1, U, "", ""),
     ("existing_spend", 2, F, "", "ws3-rd-austin-1250-month,ws3-rd-adderall-diy-crm-agency"),
     ("ability_to_pay", 2, I, "", ""),
     ("reach", 2, I, "", ""),
     ("time_to_value", 1, U, "", ""),
     ("tech_compliance_risk", 0, I, "Agency outbound for clients is cold outreach.", "g-gmail-no-spam-ucm"),
     ("competition", 0, F, "", "instantly-pricing-outreach,ws3-rd-adderall-diy-crm-agency"),
     ("onboarding", 1, I, "Multi-client, multi-mailbox.", ""),
     ("solo_founder_fit", 1, I, "", ""),
     ("retention", 1, U, "", "")])

hyp("seg-consultant", "segment", "Consultants and service providers selling high-value projects",
    "Solo or small consultancies with few, valuable deals.", "rejected",
    "A single missed follow-up can be costly, but most say Excel or a last-contacted sort is enough; low volume means low frequency.",
    [("severity", 2, F, "One forgotten 'circle back' lost a client.", "ws3-rd-opslayer-lost-client"),
     ("frequency", 1, I, "Few concurrent deals.", ""),
     ("existing_spend", 1, F, "", "ws3-cap-superhuman-consultant-paid-day5,ws3-cap-streak-aarone-price-churn"),
     ("ability_to_pay", 1, F, "", "ws3-rd-basicsonly-cant-beat-free"),
     ("reach", 2, I, "", ""),
     ("time_to_value", 1, I, "", ""),
     ("tech_compliance_risk", 2, I, "", ""),
     ("competition", 0, F, "Excel works for them.", "ws3-rd-warprawn-back-to-excel,ws3-rd-valuegen-xls-value,ws3-rd-lockrobster-excel-100"),
     ("onboarding", 3, I, "", ""),
     ("solo_founder_fit", 3, I, "", ""),
     ("retention", 1, I, "", "")])

hyp("seg-no-crm-smb", "segment", "Small businesses using email and spreadsheets instead of a CRM",
    "", "rejected",
    "Evidence found is mostly local-service quote follow-up rather than B2B email sales; no spend signal.",
    [("severity", 1, F, "", "ws3-rd-shiribazu-quote-slipped"),
     ("frequency", 1, U, "", ""),
     ("existing_spend", 0, U, "", ""),
     ("ability_to_pay", 1, U, "", ""),
     ("reach", 1, U, "", ""),
     ("time_to_value", 2, I, "", ""),
     ("tech_compliance_risk", 2, I, "", ""),
     ("competition", 1, F, "", "bigin-pricing-plans,hubspot-pricing-free"),
     ("onboarding", 2, I, "", ""),
     ("solo_founder_fit", 2, I, "", ""),
     ("retention", 1, U, "", "")])

hyp("seg-crm-laggard", "segment", "Teams that already use a CRM but fail to maintain it",
    "Cross-cutting; overlaps small teams and AEs.", "rejected",
    "Merged: at 3-10 sellers it is seg-small-team (selected); in larger companies it is seg-ae (blocked by IT).",
    [("severity", 2, F, "", "ws3-rd-raccoon-hubspot-inconsistent,ws3-rd-appx-thread-to-deal-association"),
     ("existing_spend", 2, F, "", "ws3-cap-hubspot-salesops-pricing")])

# ------------------------------------------------------------------ wedges
W = ["problem_evidence", "gap_vs_incumbents", "policy_feasibility", "build_ease", "wtp_evidence", "platform_path"]
hyp("w-crm-upkeep", "wedge", "CRM upkeep co-pilot: email activity -> proposed deal updates in the CRM the team already pays for",
    "For a 3-10 seller team on HubSpot or Pipedrive: read each rep's deal threads, attach them to the right deal, and propose stage / next step / close date / follow-up task changes. The manager approves in one click; the app writes them into the CRM. Includes a 'needs attention today' list of deals whose last customer email is unanswered or whose promised next step is overdue. No sending in v1.", "shortlisted", None,
    [("problem_evidence", 2, F, "Largest cluster (CRM data entry, 15 voices) plus wrong-deal association.", "ws3-rd-appx-thread-to-deal-association,ws3-rd-questoid-wrong-deal,ws3-rd-marcushee-batch-hygiene,ws3-rd-raccoon-hubspot-inconsistent,ws3-rd-jiesen-notetaker-copy-paste"),
     ("gap_vs_incumbents", 1, I, "Complements rather than replaces the CRM, which avoids switching. But AI auto-CRMs (Day.ai, Lightfield, Clarify) and HubSpot's own credit-metered agents are moving here; the gap may close.", "dayai-cap-ingestion,lightfield-cap-auto-crm,clarify-cap-autocrm,hubspot-pricing-credits"),
     ("policy_feasibility", 2, F, "CRM-type use is an approved Gmail use; no sending. But restricted scopes (CASA) and Microsoft admin consent are required.", "g-gmail-approved-usecases,g-casa-annual-al,m-consent-managed-mail-excluded"),
     ("build_ease", 1, I, "Gmail + Graph sync, thread-to-deal matching and two CRM write integrations; email sync is 'the part that kills these'.", "ws3-rd-akl773-email-sync-kills"),
     ("wtp_evidence", 1, U, "Existing CRM spend observed; no stated willingness to pay for this add-on.", "ws3-rd-armok-pipedrive-60"),
     ("platform_path", 2, I, "Once trusted with deal context, can extend to drafting replies, follow-up scheduling and manager reporting.", "")])

hyp("w-followup-accountability", "wedge", "Follow-up accountability layer (no deal goes stale)",
    "Detect threads where the prospect is waiting on us or has gone quiet after a commitment; surface a daily list with drafted follow-ups for human send.", "shortlisted",
    None,
    [("problem_evidence", 2, F, "Missed follow-ups cost real deals.", "ws3-rd-opslayer-lost-client,ws3-rd-shiribazu-quote-slipped,ws3-rd-keepitgoing-spreadsheet-fell-away"),
     ("gap_vs_incumbents", 0, F, "folk Follow-up Assistant, Superhuman auto-reminders, Gmail nudges (free) and Close suggested actions already do this; users fix it with scheduled send or routines.", "folk-cap-followup-assistant,superhuman-cap-auto-reminders,gmail-cap-nudges,close-cap-suggested-actions,ws3-rd-akl773-scheduled-send,ws3-rd-donmao-routine"),
     ("policy_feasibility", 2, F, "Human-sent follow-ups are ordinary correspondence; Gmail add-on scopes can even avoid CASA for drafting, but not for background detection.", "g-addon-compose-temp,g-addon-scopes-temporary"),
     ("build_ease", 2, I, "", ""),
     ("wtp_evidence", 1, F, "One consultant paid for Superhuman to stop missing emails.", "ws3-cap-superhuman-consultant-paid-day5"),
     ("platform_path", 2, I, "", "")])

hyp("w-inbox-to-pipeline", "wedge", "Inbox-to-pipeline system that builds and maintains deals automatically (replacing the CRM)",
    "", "rejected",
    "Same problem as w-crm-upkeep but asks teams to switch CRM; directly against Streak, Copper, Day.ai, Lightfield, Clarify and folk, several with free tiers.",
    [("problem_evidence", 2, F, "", "ws3-rd-appx-thread-to-deal-association"),
     ("gap_vs_incumbents", 0, F, "", "streak-cap-magic-fields,copper-cap-gmail,dayai-cap-ingestion,lightfield-cap-auto-crm,clarify-cap-autocrm"),
     ("policy_feasibility", 2, F, "", "g-gmail-approved-usecases"),
     ("build_ease", 0, F, "", "ws3-rd-akl773-email-sync-kills"),
     ("wtp_evidence", 1, U, "", ""),
     ("platform_path", 3, I, "", "")])

hyp("w-next-best-action", "wedge", "Next-best-action assistant per conversation", "", "rejected",
    "A feature, not a product: Close Suggested Actions and Pipedrive's AI assistant already ship it inside the CRM.",
    [("problem_evidence", 1, I, "", ""), ("gap_vs_incumbents", 0, F, "", "close-cap-suggested-actions,pipedrive-cap-ai-email"),
     ("policy_feasibility", 2, F, "", "g-gmail-approved-usecases"), ("build_ease", 2, I, "", ""), ("wtp_evidence", 0, U, "", ""), ("platform_path", 1, I, "", "")])

hyp("w-light-outbound", "wedge", "Lightweight outbound workspace (prospecting + sequences through the user's mailbox)", "", "rejected",
    "Launch-blocking policy risk (unsolicited commercial mail via Gmail scopes) and a crowded, cheap market (Instantly $47/mo, Apollo free campaigns).",
    [("problem_evidence", 2, F, "", "ws3-rd-austin-1250-month"), ("gap_vs_incumbents", 0, F, "", "instantly-pricing-outreach,apollo-cap-free-gmail,smartlead-pricing-base"),
     ("policy_feasibility", 0, F, "", "g-gmail-no-spam-ucm,g-gmail-pp-no-ucm,g-udp-enforcement-enable-violation,ca-casl-consent"), ("build_ease", 1, I, "", ""),
     ("wtp_evidence", 2, F, "", "ws3-rd-tallest-2k-month"), ("platform_path", 1, I, "", "")])

hyp("w-proposal-tracker", "wedge", "Proposal and negotiation tracker for unanswered commercial threads", "", "rejected",
    "Only 2 voices for stalled-deal visibility; area G (proposals) had no direct evidence in the pilot. Kept as a feature of w-crm-upkeep's attention list.",
    [("problem_evidence", 1, F, "", "ws3-rd-shiribazu-quote-slipped,ws3-rd-opslayer-lost-client"), ("gap_vs_incumbents", 1, I, "", ""),
     ("policy_feasibility", 2, I, "", ""), ("build_ease", 2, I, "", ""), ("wtp_evidence", 0, U, "", ""), ("platform_path", 1, I, "", "")])

hyp("w-relationship-memory", "wedge", "Relationship memory (commitments and history)", "", "rejected",
    "Users who care say notes/Excel/Obsidian already work; folk Recap and Day.ai customer memory exist.",
    [("problem_evidence", 1, F, "", "ws3-rd-dennismullen-one-man-crm,ws3-rd-lockrobster-excel-100"), ("gap_vs_incumbents", 0, F, "", "folk-cap-recap,dayai-cap-ingestion"),
     ("policy_feasibility", 2, I, "", ""), ("build_ease", 2, I, "", ""), ("wtp_evidence", 0, U, "", ""), ("platform_path", 2, I, "", "")])

hyp("w-manager-dashboard", "wedge", "Manager dashboard of neglected deals without perfect CRM hygiene", "", "rejected",
    "Voices come from AEs at larger companies (blocked by IT); for small teams this is the output of w-crm-upkeep rather than a separate product.",
    [("problem_evidence", 1, F, "", "ws3-rd-mcburloak-manager-spreadsheet,ws3-rd-hazard-verbal-updates"), ("gap_vs_incumbents", 1, I, "", ""),
     ("policy_feasibility", 1, F, "Needs every rep's mailbox read: Microsoft admin consent and Workspace admin approval.", "m-consent-managed-mail-excluded,g-admin-restrict-gmail"),
     ("build_ease", 1, I, "", ""), ("wtp_evidence", 1, U, "", ""), ("platform_path", 2, I, "", "")])

# ------------------------------------------------------------------ architectures
hyp("arch-a-dashboard", "architecture", "A: Secondary sales dashboard on top of Gmail/Outlook", "Email stays in Gmail/Outlook; a web app holds tasks, follow-ups and deal view.", "rejected",
    "Selected in its CRM-companion variant (arch-e) instead: a standalone dashboard becomes yet another tool in the sprawl users complain about.",
    [("complexity", 2, I, "", ""), ("provider_dependence", 1, F, "Background reads need Gmail restricted scopes and Microsoft admin consent.", "g-scope-restricted,m-consent-managed-mail-excluded"),
     ("time_to_v1", 2, I, "", ""), ("onboarding", 2, I, "", ""), ("replacement_risk", 1, F, "", "gmail-cap-nudges,folk-cap-followup-assistant"),
     ("wtp", 1, U, "", ""), ("defensibility", 1, I, "", "")])
hyp("arch-b-client", "architecture", "B: Sales-focused email client", "", "rejected",
    "Asks users to change their primary email interface; full client engineering; Superhuman ($33) and Gmail improvements set the bar, and one reviewer already finds Superhuman redundant.",
    [("complexity", 0, I, "", ""), ("provider_dependence", 0, F, "", "g-scope-restricted"), ("time_to_v1", 0, I, "", ""),
     ("onboarding", 0, I, "", ""), ("replacement_risk", 0, F, "", "ws3-cap-superhuman-svp-gmail-redundant,superhuman-pricing-business"),
     ("wtp", 1, F, "", "ws3-cap-superhuman-consultant-paid-day5"), ("defensibility", 1, I, "", "")])
hyp("arch-c-workspace", "architecture", "C: Email-centric sales workspace (inbox + CRM + sequences + tasks)", "", "rejected",
    "Rebuilds a CRM and an outreach tool at once; competes with Close, Pipedrive, HubSpot, Streak; sequences to cold prospects hit the policy wall.",
    [("complexity", 0, F, "", "ws3-rd-akl773-email-sync-kills"), ("provider_dependence", 0, F, "", "g-gmail-no-spam-ucm"), ("time_to_v1", 0, I, "", ""),
     ("onboarding", 1, I, "", ""), ("replacement_risk", 0, F, "", "close-positioning,pipedrive-positioning,streak-cap-magic-fields"), ("wtp", 1, U, "", ""), ("defensibility", 1, I, "", "")])
hyp("arch-d-copilot", "architecture", "D: AI sales copilot executing approved actions", "", "open",
    None,
    [("complexity", 1, I, "", ""), ("provider_dependence", 1, F, "", "g-scope-restricted,m-consent-managed-mail-excluded"), ("time_to_v1", 1, I, "", ""),
     ("onboarding", 1, F, "Trust barrier to granting full email control.", "ws3-cap-mixmax-owner-unnerving-allow,ws3-hn-lnrd-email-access-chilling"),
     ("replacement_risk", 0, F, "HubSpot agents, Day.ai Turbo, Close's AI agent.", "hubspot-cap-prospecting-agent,dayai-cap-turbo,close-positioning"), ("wtp", 1, U, "", ""), ("defensibility", 1, I, "", "")])
hyp("arch-e-crm-companion", "architecture", "E: CRM companion (narrow variant of A + D): mailbox in, approved updates out to the customer's existing CRM", "Reads mail (or the CRM's own logged email) and writes approved updates into HubSpot/Pipedrive; the CRM stays the system of record; no sending in v1.", "selected", None,
    [("complexity", 2, I, "No CRM, no client, no sending; the hard parts are sync and thread-to-deal matching.", "ws3-rd-akl773-email-sync-kills"),
     ("provider_dependence", 1, F, "Still needs restricted Gmail scopes / Microsoft admin consent unless the CRM's logged emails suffice (unknown).", "g-scope-restricted,m-consent-managed-mail-excluded"),
     ("time_to_v1", 2, I, "A concierge version can run before any code.", ""),
     ("onboarding", 2, I, "Connect CRM + mailboxes; buyer is usually the admin.", ""),
     ("replacement_risk", 1, F, "CRMs are adding agents (credit-metered).", "hubspot-pricing-credits,hubspot-cap-prospecting-agent"),
     ("wtp", 1, U, "", ""), ("defensibility", 1, I, "Matching accuracy and trust can compound; little else is defensible.", "")])

# ------------------------------------------------------------------ pricing
hyp("price-per-user", "pricing", "Per-user monthly ($15-30/seat)", "Anchored below Streak Pro ($49) and folk Premium ($48), above Bigin.", "shortlisted", None,
    [("revenue_per_customer", 2, I, "5 seats x $25 = $125/mo.", "streak-pricing-pro,folk-pricing-plans"), ("margin_safety", 2, I, "AI cost scales with seats.", "ai-price-haiku,ai-price-sonnet"),
     ("buyer_fit", 1, F, "Per-seat packaging pushed one team off paid HubSpot.", "ws3-cap-pipedrive-mktmgr-hubspot-seats")])
hyp("price-per-workspace", "pricing", "Per-team flat price ($99-199/mo up to 10 seats)", "Like Clarify's team pricing; removes the 'every seat costs' objection.", "selected", None,
    [("revenue_per_customer", 2, I, "", "clarify-pricing-plans"), ("margin_safety", 1, I, "Heavy-mail teams can erode margin; cap mailboxes.", ""),
     ("buyer_fit", 3, F, "Seat-count objections observed; manager buys for the team.", "ws3-cap-pipedrive-mktmgr-hubspot-seats,ws3-rd-armok-pipedrive-60")])
hyp("price-tiered", "pricing", "Tiered by connected mailboxes / features", "", "open", None,
    [("revenue_per_customer", 2, I, "", ""), ("margin_safety", 2, I, "", ""), ("buyer_fit", 1, I, "Feature-gating is a recurring complaint about HubSpot.", "ws3-cap-hubspot-salesops-pricing")])

# ------------------------------------------------------------------ added risks & unknowns
for r in [
    {"slug": "incumbent-bundling", "area": "commercial", "risk": "HubSpot, Pipedrive and Close ship AI that updates deals from email as a bundled feature, collapsing an add-on's value.", "likelihood": "high", "impact": "high",
     "refs": "hubspot-pricing-credits,hubspot-cap-prospecting-agent,pipedrive-cap-ai-email,close-cap-suggested-actions", "mitigation": "Stay CRM-agnostic (HubSpot + Pipedrive), sell to teams below HubSpot Pro, measure matching accuracy versus native features in experiment E3."},
    {"slug": "ai-crm-crowding", "area": "commercial", "risk": "Funded AI-native CRMs (Day.ai, Lightfield, Clarify) target the same buyer with auto-updated records.", "likelihood": "high", "impact": "medium",
     "refs": "dayai-positioning,lightfield-positioning,clarify-cap-autocrm", "mitigation": "Do not replace the CRM; position as zero-migration."},
    {"slug": "discipline-not-tooling", "area": "commercial", "risk": "Buyers believe the problem is habits and process; software is not purchased to fix it.", "likelihood": "medium", "impact": "high",
     "refs": "ws3-rd-kubrador-habits,ws3-hn-ancientcap-workflow-not-tooling,ws3-rd-foresythe-process-not-crm", "mitigation": "Concierge audit first: show the cost of stale deals in their own data before selling software."},
]:
    add({"kind": "risk", **r})
for u in [
    {"slug": "wtp-small-team", "question": "Will a 3-10 seller team pay $99-199/month for CRM upkeep on top of their existing CRM?", "why_it_matters": "No stated willingness to pay was found in desk research.", "gate": 5, "resolve_by": "exp-concierge-audit, exp-paid-pilot"},
    {"slug": "permission-grant-rate", "question": "What share of target teams will grant full mailbox read (Gmail restricted / M365 Mail.Read) to a new vendor?", "why_it_matters": "Evidence of refusal exists for larger companies; none for small-team owners either way.", "gate": 3, "resolve_by": "exp-permission-test"},
    {"slug": "crm-logged-email-sufficient", "question": "For teams whose CRM already logs email (HubSpot/Pipedrive inbox sync), can the CRM API supply enough thread content to propose updates without any Gmail/Graph scopes?", "why_it_matters": "If yes, v1 avoids CASA and Microsoft admin consent entirely.", "gate": 3, "resolve_by": "Read HubSpot and Pipedrive API docs on email engagements (not covered in this pilot)."},
    {"slug": "native-crm-ai-overlap", "question": "Do HubSpot Starter/Pro and Pipedrive already propose deal-stage/next-step updates from email natively, and how accurately?", "why_it_matters": "Decides whether the wedge has any gap left.", "gate": 2, "resolve_by": "exp-native-benchmark"},
    {"slug": "acquisition-channel", "question": "Which channel reaches 3-10 seller teams at an acceptable cost (CRM app marketplaces, communities, outbound)?", "why_it_matters": "CAC versus a ~$150/mo account decides sustainability.", "gate": 6, "resolve_by": "exp-concierge-audit recruitment metrics"},
    {"slug": "outlook-share", "question": "What share of the target segment runs Microsoft 365 rather than Google Workspace?", "why_it_matters": "Decides whether Microsoft admin consent or Google CASA comes first.", "gate": 6, "resolve_by": "Screening question in interviews"},
]:
    add({"kind": "unknown", "status": "open", **u})

# ------------------------------------------------------------------ experiments
EXP = [
 {"slug": "exp-problem-interviews", "rank": 1, "hypothesis": "Heads of sales at 3-10 seller B2B teams on HubSpot/Pipedrive can name a deal lost or delayed in the last 90 days because an email follow-up or CRM update was missed, and spend >= 2 h/week per rep on CRM upkeep.",
  "participants": "15 heads of sales / sales-led founders, 3-10 sellers, B2B, on HubSpot or Pipedrive.", "recruitment": "Personal network, LinkedIn search by title + company size, r/sales and founder communities (no paid panels without approval).",
  "procedure": "30-min problem interview using the last real example (no pitching); screen for CRM, mail provider, who is admin, current spend.", "cost": "Time only (~12 h).", "duration": "10 days",
  "success": ">= 8 of 15 give a specific recent example with an estimated deal value AND report >= 2 h/week/rep upkeep.", "failure": "<= 4 of 15 can name a concrete example, or most say a routine already solves it.",
  "confounders": "Interviewer leading; recall bias; network skew towards tech companies.", "decisions": "Pass -> run exp-concierge-audit. Fail -> STOP this wedge; re-test w-followup-accountability with consultants only, or stop."},
 {"slug": "exp-concierge-audit", "rank": 2, "hypothesis": "A manually produced 'stale pipeline audit' (deals with unanswered customer email, overdue promised next steps, threads attached to wrong deals) is valuable enough that teams pay for it.",
  "participants": "Interviewees who passed exp-problem-interviews.", "recruitment": "Offer at end of interview.",
  "procedure": "With written consent, the head of sales exports CRM deals and shares (or screen-shares) relevant threads; analyst produces the audit by hand within 48 h; offer a monthly repeat for a fee.", "cost": "Time; no API access needed.", "duration": "3 weeks",
  "success": ">= 5 teams accept the free audit AND >= 3 pay >= $100 for a second month (actual payment, not intent).", "failure": "< 3 accept the audit, or 0 pay.",
  "confounders": "Data sharing reluctance may reduce uptake independently of value; novelty effect.", "decisions": "Pass -> build exp-paid-pilot with provider-approved integrations. Fail -> STOP."},
 {"slug": "exp-permission-test", "rank": 3, "hypothesis": "Target buyers will connect their mailboxes and CRM to a new vendor's app.",
  "participants": "Concierge-audit participants plus 10 cold prospects from the same segment.", "recruitment": "As above.",
  "procedure": "Show the exact Google/Microsoft consent screens (mocked from the documented scopes) and ask them to complete a test connection to an unverified test app within the 100-user cap.", "cost": "Small; test app registration is free.", "duration": "2 weeks (parallel)",
  "success": ">= 60% complete the connection; where an M365 admin is required, the buyer is the admin in >= 70% of cases.", "failure": "< 40% complete, or IT approval needed in most tenants.",
  "confounders": "Unverified-app warning screen inflates refusals relative to a verified app.", "decisions": "Fail -> pursue the CRM-API-only variant (unknown crm-logged-email-sufficient) or STOP."},
 {"slug": "exp-native-benchmark", "rank": 4, "hypothesis": "Native CRM features (HubSpot, Pipedrive) leave >= 30% of deal updates or thread associations wrong or missing on real data.",
  "participants": "2-3 audit participants who consent.", "recruitment": "From exp-concierge-audit.",
  "procedure": "Compare the manual audit with what the CRM's native AI/inbox sync recorded for the same deals.", "cost": "Time.", "duration": "1 week",
  "success": ">= 30% of updates missing or wrong in native tooling.", "failure": "< 10% (incumbent already solves it).",
  "confounders": "Teams may not have enabled native features.", "decisions": "Fail -> STOP (incumbent bundling)."},
 {"slug": "exp-mockup", "rank": 5, "hypothesis": "A 'needs attention today' approval queue is the interface managers would use weekly.",
  "participants": "Same participants.", "recruitment": "-", "procedure": "Clickable mockup populated with their own audit results; observe a weekly pipeline review.", "cost": "~2 days design.", "duration": "1 week",
  "success": ">= 4 of 6 use it in their actual pipeline review.", "failure": "They prefer the spreadsheet/PDF audit.", "confounders": "Politeness.", "decisions": "Fail -> keep it a service, not software."},
 {"slug": "exp-provider-clarification", "rank": 6, "hypothesis": "Google will confirm in writing that a CRM-companion app that does not send mail fits the approved Gmail restricted-scope use cases; CASA cost is affordable (< $5k/yr).",
  "participants": "Google OAuth verification support; one CASA-authorised lab.", "recruitment": "-", "procedure": "Ask in writing (requires approval before contacting third parties).", "cost": "Free to ask; CASA fee unknown.", "duration": "2-4 weeks",
  "success": "Written confirmation and a quote < $5k/yr.", "failure": "Rejection, or a quote > $15k/yr before revenue.", "confounders": "Answers may be non-committal.", "decisions": "Fail -> Microsoft-first or CRM-API-only variant."},
 {"slug": "exp-paid-pilot", "rank": 7, "hypothesis": "Teams keep paying once software replaces the concierge.",
  "participants": "Paying concierge customers.", "recruitment": "-", "procedure": "Ship the minimal CRM companion within the 100-user unverified cap / a single M365 tenant admin consent; 60-day paid pilot.", "cost": "Build ~6-10 weeks.", "duration": "60 days",
  "success": ">= 3 teams pay for month 3 and approve >= 50% of proposed updates weekly.", "failure": "< 2 retain.", "confounders": "Founder hand-holding inflates retention.", "decisions": "Pass -> PROCEED to CASA verification. Fail -> STOP."},
]
for e in EXP:
    add({"kind": "experiment", "status": "designed", **e})

# ------------------------------------------------------------------ gates
G = [
 (1, "Frequent and costly customer problem", "Verified first-hand evidence from >= 10 independent voices that the problem recurs weekly and has caused lost or delayed revenue, with counter-evidence weaker than support.", "conditional",
  "CRM upkeep/association pain has 15 + 8 first-hand voices and is frequent, but direct revenue loss is anecdotal (2-3 voices), and 32 voices say simple tools or habits suffice.", "ws3-rd-appx-thread-to-deal-association,ws3-rd-opslayer-lost-client,ws3-rd-kubrador-habits"),
 (2, "Existing products leave a meaningful gap", "A job that the cheapest adequate incumbent does not do, verified in documentation.", "unresolved",
  "Every single capability exists somewhere (Streak, folk, Close, Day.ai, HubSpot). The remaining gap is a zero-migration companion for HubSpot/Pipedrive teams below HubSpot Pro pricing, plus Outlook users without an inbox-native option. Native accuracy is untested.", "streak-cap-magic-fields,folk-cap-followup-assistant,close-cap-suggested-actions,dayai-cap-ingestion,hubspot-cap-sequences-pro"),
 (3, "Technical feasibility via supported integrations", "All v1 functions possible through Gmail API / Microsoft Graph with documented scopes, limits and notifications.", "pass",
  "Read, thread, watch/notify, draft and send are all documented; the cost is restricted-scope verification (annual CASA) and Microsoft admin consent.", "g-push-watch-renew,g-threading-rules,m-subscription-lifetime,m-createreply-draft"),
 (4, "Policy and compliance feasibility", "The v1 use case is an explicitly approved use and no launch-blocking policy conflict exists.", "conditional",
  "Pass for CRM/correspondence/drafting; FAIL for automated cold outreach through connected mailboxes (removed from scope). Google wording on 'the user consented' needs written clarification.", "g-gmail-approved-usecases,g-gmail-no-spam-ucm,g-gmail-pp-no-ucm"),
 (5, "Willingness to pay", ">= 3 customers pay real money for the narrow wedge (concierge counts).", "unresolved",
  "Desk research shows spend on CRMs and on cold-email infrastructure but no stated willingness to pay for this add-on; price churn exists.", "ws3-rd-armok-pipedrive-60,ws3-cap-streak-aarone-price-churn"),
 (6, "Reachable initial segment", "A named persona reachable without paid acquisition, with >= 15 interviews bookable in 2 weeks.", "unresolved",
  "Persona defined (head of sales at a 3-10 seller team on HubSpot/Pipedrive); channel untested.", ""),
 (7, "Narrow MVP without an ESP", "v1 sends nothing at volume and needs no own sending infrastructure.", "pass",
  "The CRM companion writes to the CRM and proposes drafts; no sending in v1.", "g-addon-compose-temp"),
 (8, "Credible path to sustainable unit economics", "Gross margin >= 70% at <= $30/seat-equivalent, and CAC payback < 12 months plausible.", "conditional",
  "AI + infra cost estimated $3-10/seat/month (inference from verified token prices), but CASA cost and CAC are unknown.", "ai-price-haiku,ai-price-sonnet,ai-price-batch,pubsub-price"),
]
for gid, name, crit, status, why, refs in G:
    add({"kind": "gate", "id": gid, "name": name, "pass_criterion": crit, "status": status, "rationale": why, "refs": refs})

with open(OUT, "w") as f:
    for r in R:
        f.write(json.dumps(r) + "\n")
print(len(R), "records")
