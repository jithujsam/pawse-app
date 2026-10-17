# DELECTA: Deep Market, Product, Technical, and Commercial Research

## Mission

Conduct exhaustive, evidence-driven research to determine whether we should build an email-centric sales workspace that gives salespeople and small sales teams control over their entire sales cycle through email.

This is not simply a cold-email tool, an email client, a CRM, or an Instantly clone.

The hypothesis is that email is where much of B2B sales communication happens, but the actual workflow is fragmented across inboxes, spreadsheets, CRMs, reminders, outreach tools, calendars, and individual memory.

We want to investigate whether there is a valuable opportunity to unify these activities into one secondary workspace that sits on top of existing email accounts and makes sure that no prospect, conversation, opportunity, or follow-up gets forgotten.

The research must determine whether this is a genuine unmet need, whether existing products already solve it, whether it is technically and legally feasible, and whether a small team or solo founder can build and sell it.

**Do not assume the idea is good. Try to disprove it. Do not write product code or start implementation during this research.**

---

## 1. Product hypothesis

Investigate a product that connects to a salesperson's existing work email and turns their inbox into an actionable sales workspace.

A potential user might be:

- A founder responsible for their own sales.
- A salesperson or account executive managing multiple active opportunities.
- An SDR who needs to prospect, send outreach, and follow up consistently.
- A small B2B company with 3–10 salespeople but no dedicated outbound operations team.
- A small sales team that finds traditional CRMs too cumbersome or expensive.
- A company whose sales process runs primarily through email and whose CRM discipline is inconsistent.

These are hypotheses about possible customer segments, not confirmed target markets. Evaluate them independently and identify the strongest initial customer.

### Illustrative workflow

A salesperson connects their existing work email account.

They receive a new prospect or opportunity. They can:

1. Understand who the prospect is, the company, previous conversations, and the potential business opportunity.
2. Research or organize information about the prospect using permitted data sources.
3. Prepare personalized outreach based on the context and objective.
4. Send or schedule the email through an authorized email provider.
5. Automatically organize the resulting conversation and associate it with the right prospect or deal.
6. Know when a reply arrives and whether it requires action.
7. Schedule the next follow-up based on the actual conversation, rather than blindly sending generic messages.
8. Track the relationship from first contact through qualification, meeting, proposal, negotiation, won, or lost.
9. See every deal that needs attention today.
10. Identify stalled conversations, missed follow-ups, unanswered proposals, and opportunities that may be slipping away.
11. Draft replies using the full history of the relationship.
12. Maintain a reliable history of what happened, what was promised, and what should happen next.

The product should make email the primary operating surface for sales, while providing a structured dashboard for control, visibility, and accountability.

Investigate whether the best architecture is:
- A secondary dashboard connected to Gmail and Microsoft Outlook.
- An email client with sales-specific capabilities.
- A sales workspace that combines inbox, CRM, sequences, and task management.
- An agentic sales assistant that prepares and executes approved actions.
- A narrower product focused on one painful workflow.

Do not choose the architecture before examining the evidence.

---

## 2. Research rules and evidence standards

This research must be reproducible and auditable.

### Source requirements

Prioritize:

1. Original customer discussions on Reddit, relevant professional communities, and public forums.
2. Detailed user complaints, feature requests, reviews, and negative reviews on G2, Capterra, app marketplaces, and product review sites.
3. Product documentation, pricing pages, API documentation, OAuth policies, and official provider terms.
4. Competitor product announcements, changelogs, help documents, and customer case studies.
5. Independent market research and credible industry reports.
6. Job descriptions and public discussions that reveal operational workflows and existing spending.

Use search engines to discover sources, but inspect the original source before treating a claim as verified.

For each meaningful customer evidence item, record:

- Original URL.
- Exact relevant quotation or faithful excerpt.
- Publication date, where available.
- Author or source identity, where public and appropriate.
- Product or workflow being discussed.
- Customer segment.
- Specific pain point.
- Current workaround.
- Evidence of frequency, severity, or financial impact.
- Whether the person appears to be describing personal experience or repeating a general opinion.
- Confidence and verification status.

Deduplicate repeated posts, syndicated content, and multiple complaints from the same person. Do not count repeated mentions of the same underlying complaint as independent demand.

Do not invent quotations, customer counts, market sizes, product capabilities, API permissions, or pricing.

Clearly distinguish:
- Verified facts.
- Direct customer evidence.
- Inferences.
- Assumptions.
- Unknowns requiring experiments.

Search-result snippets are discovery leads, not sufficient proof. Where the original source cannot be accessed, mark it unverified.

### Adversarial standard

For every attractive opportunity, investigate why it might fail.

Actively search for evidence that:
- Customers already have adequate solutions.
- The problem is annoying but not worth paying to solve.
- Users will not grant email permissions.
- Existing CRMs and email clients already offer the required workflow.
- Automated cold outreach through connected inboxes creates unacceptable provider-policy or deliverability risks.
- The product is difficult to differentiate.
- Customer acquisition costs exceed realistic subscription revenue.
- The proposed feature belongs inside an established platform rather than in a standalone product.

A high number of complaints does not establish willingness to pay.

---

## 3. Research customer problems before proposing features

Investigate how people currently manage the sales cycle through email.

Study the workflow from the first prospecting action to the final outcome.

### Workflow areas

A. Prospect discovery and list preparation.

B. Initial outreach and personalization.

C. Follow-up scheduling and execution.

D. Inbox triage and prioritization.

E. Reply classification and next-action decisions.

F. Conversation and deal context.

G. Meetings, proposals, quotations, and negotiations.

H. Stalled opportunities and missed commitments.

I. Handoffs between SDRs, account executives, and founders.

J. Pipeline reporting and management visibility.

K. Relationship history, notes, and promises made in email.

L. CRM data entry and keeping deal stages synchronized.

M. Deliverability, sending limits, permissions, and mailbox management.

For each area, determine:

- Who experiences the problem?
- How frequently does it occur?
- What triggers it?
- What does the user do today?
- What tools are involved?
- What breaks or gets forgotten?
- What is the operational or financial consequence?
- How do users know the problem has been solved?
- What have they already tried?
- What would make them switch or pay?

Do not assume every sales team needs all these capabilities.

Identify the smallest, most expensive, most frequent problem that can be solved independently.

---

## 4. Conduct competitor and substitute analysis

Investigate direct competitors, adjacent products, and products that could eliminate the need for our product.

At minimum, examine the relevant capabilities of:

- Gmail and Google Workspace.
- Microsoft Outlook and Microsoft 365.
- HubSpot Sales Hub.
- Salesforce Sales Cloud.
- Apollo.
- Instantly.
- Smartlead.
- Saleshandy.
- Streak.
- Mixmax.
- Yesware.
- Salesloft.
- Outreach.
- Front.
- Superhuman.
- Attio.
- Pipedrive.
- Close.
- Other relevant email-centric CRM and sales engagement products discovered during research.

Do not assume this list is exhaustive or that every product is a direct competitor. Verify current product capabilities and availability.

For each relevant competitor, investigate:

1. Target customer and buyer.
2. Core job it solves.
3. Email-provider integrations.
4. Inbox experience and whether it operates inside or alongside the existing inbox.
5. Prospect management.
6. Personalized outreach.
7. Automated sequences and follow-ups.
8. Reply detection and conversation association.
9. Deal stages and pipeline visibility.
10. AI-assisted research, writing, and decision-making.
11. Task management and reminders.
12. Team collaboration and management visibility.
13. Pricing, plan limits, and minimum commitments.
14. API access, integration requirements, and relevant restrictions.
15. Repeated customer complaints.
16. Features users still perform manually.
17. Evidence of switching, dissatisfaction, or unmet demand.

Create a capability matrix based on verified evidence.

Then answer the critical question:

**What job would our product do substantially better than the tools customers already have?**

A different interface or a collection of AI features is not sufficient differentiation.

Investigate whether a genuine gap exists in the transitions between inbox, follow-up, deal context, and next actions.

---

## 5. Investigate the email-provider feasibility question

This is a critical workstream and a potential project-killing constraint.

We do not want to operate an email service provider, build a mail-server network, or maintain our own outbound sending infrastructure unless the research demonstrates that doing so is necessary and commercially justified.

Investigate whether the product can use users' existing Gmail, Google Workspace, Outlook, and Microsoft 365 accounts through official APIs.

### Google

Inspect current official documentation for:

- Gmail API sending and reading capabilities.
- OAuth scopes and verification.
- Sensitive and restricted scopes.
- OAuth consent and application verification.
- Restricted-scope security assessment requirements, if applicable.
- Google Workspace administrator controls.
- Gmail API quotas and sending-related limitations.
- Google Workspace email policies relevant to commercial and unsolicited outreach.
- Restrictions on using Gmail APIs for bulk or unsolicited commercial email.
- Application review requirements for a multi-tenant SaaS.
- Whether a product focused on sales workflow, relationship management, and authorized business communication can be approved for its intended use case.

### Microsoft

Inspect current official documentation for:

- Microsoft Graph mail APIs.
- Delegated versus application permissions.
- Sending, reading, and change-notification capabilities.
- Tenant administrator consent.
- Microsoft identity application registration and verification.
- Service limits, throttling, and sending restrictions.
- Exchange Online policies relevant to automated and unsolicited email.
- Multi-tenant application considerations.

### Additional technical questions

Investigate:

- OAuth versus storing mailbox passwords.
- Whether SMTP and IMAP are necessary or appropriate.
- Secure token storage and refresh.
- Email threading and message identifiers.
- Incoming reply detection and webhooks or change notifications.
- Token revocation and disconnection.
- Mailbox synchronization and historical data access.
- Multiple mailboxes per organization.
- Shared inboxes and aliases.
- Attachments and calendar integrations.
- Audit logs, retention, encryption, deletion, and tenant isolation.
- Rate limits and retry behavior.
- Handling duplicate messages and failed sends.
- Unsubscribe and suppression logic.
- Email authentication and domain configuration.
- Privacy, applicable Indian data-protection requirements, and international customer requirements.

For each provider, produce a feasibility matrix with:

| Question | Required finding |
|---|---|
| Can we connect? | Officially supported integration method |
| Can we read and organize conversations? | Permissions, limitations, and approval |
| Can we send messages? | Permissions, policies, and applicable restrictions |
| Can we schedule follow-ups? | Supported architecture and constraints |
| Can we detect replies? | API or notification mechanism |
| Can we associate messages with deals? | Available metadata and implementation approach |
| Can we serve paying SaaS customers? | Multi-tenant application and review requirements |
| What can block launch? | Specific policy, technical, or commercial risks |

Use official documentation for policy conclusions. If the intended use case is ambiguous, state that it needs written clarification from the provider. Do not interpret an available API endpoint as blanket permission for every commercial use.

**Go/no-go requirement:** Determine whether automated outreach to non-consenting prospects is permitted for the intended product, and distinguish that question from sending ordinary business correspondence, following up with existing contacts, and communicating with opted-in recipients.

Do not assume that sending only 30–50 emails daily makes a prohibited use case acceptable.

If the intended cold-outreach workflow cannot be supported reliably, determine whether a commercially useful product can still work with existing conversations, approved recipients, draft creation, human review, or other permitted workflows.

---

## 6. Evaluate the actual product architecture

Compare at least four possible architectures.

### Architecture A: Secondary sales dashboard

Connects to the existing email provider. Email stays in Gmail or Outlook, while the secondary app controls tasks, follow-ups, contact context, and deal visibility.

### Architecture B: Sales-focused email client

Provides a dedicated interface for email, conversations, tasks, and deal progression.

Investigate the additional engineering and adoption costs of asking users to change their primary email interface.

### Architecture C: Email-centric sales workspace

Combines inbox synchronization, lightweight CRM, outreach preparation, follow-up automation, and pipeline management in one application.

### Architecture D: AI sales copilot

Monitors authorized conversations, identifies relevant changes, proposes next steps, prepares responses, and executes permitted actions under user-defined approval rules.

For each architecture, estimate:

- Implementation complexity.
- Dependencies on provider permissions.
- Ongoing API and infrastructure costs.
- Security and privacy burden.
- Time to first usable version.
- User onboarding friction.
- Risk of being replaced by an existing CRM feature.
- Potential willingness to pay.
- Difficulty of acquiring customers.
- Long-term defensibility.

Recommend one initial architecture based on evidence rather than technical novelty.

---

## 7. Research customer segments and select a beachhead

Evaluate the following segments separately:

1. Founders doing their own B2B sales.
2. Small B2B teams with 3–10 salespeople.
3. Individual account executives managing active opportunities.
4. SDRs handling prospecting and follow-ups.
5. Small agencies managing multiple clients' sales pipelines.
6. Consultants and service providers selling high-value projects.
7. Small businesses that use email and spreadsheets instead of a CRM.
8. Teams that already use a CRM but fail to maintain it consistently.

Score each segment on:

- Severity of the problem.
- Frequency of the problem.
- Existing spending on solutions.
- Ability and willingness to pay.
- Ease of reaching decision-makers.
- Time required to demonstrate value.
- Technical and compliance risk.
- Competition.
- Complexity of onboarding.
- Suitability for a solo founder.
- Likelihood of retaining customers.

Recommend one beachhead segment and one specific user persona.

Explain why that segment is better than the alternatives.

Do not select a market solely because it is large.

---

## 8. Establish the actual product wedge

Generate several competing product hypotheses, then compare them.

Potential examples to investigate include:

- A follow-up accountability layer that prevents deals from going stale.
- An inbox-to-pipeline system that maintains deal context automatically.
- A sales assistant that identifies the next best action for each conversation.
- A lightweight outbound workspace for reps who do not need a complex sales engagement platform.
- A proposal and negotiation tracker that detects unanswered commercial conversations.
- A relationship memory system that records commitments and conversation history.
- A sales manager dashboard that identifies neglected opportunities without requiring perfect CRM hygiene.

These are starting hypotheses, not recommendations.

For each candidate, specify:

- Exact customer.
- Painful triggering event.
- Existing workaround.
- Proposed intervention.
- Expected measurable outcome.
- Why current products fail to solve it adequately.
- Required integrations.
- Minimum viable feature set.
- Likely buyer and purchasing process.
- Plausible price range and evidence supporting it.
- Most serious reason it might fail.

Select the narrowest wedge that can deliver standalone value and provide a credible path to the broader platform.

---

## 9. Research willingness to pay and business economics

Investigate what customers currently pay for inbox tools, sales engagement platforms, CRMs, prospecting tools, and workflow automation.

Use current, verified pricing wherever possible.

Model at least three pricing structures:

- Per-user monthly subscription.
- Per-team or workspace subscription.
- Tiered pricing based on seats, connected mailboxes, or workflow capabilities.

For each, estimate:

- Revenue per customer.
- Email API and infrastructure costs.
- AI inference costs.
- Data and enrichment costs, if applicable.
- Support and onboarding burden.
- Security and compliance costs.
- Gross margin sensitivity.
- Customer acquisition challenges.
- Likely churn risks.

Use transparent assumptions and ranges. Do not present speculative market size or revenue projections as facts.

Determine whether this could realistically become a sustainable small SaaS business before considering venture-scale growth.

---

## 10. Build a reproducible evidence database

Organize the research so another person can inspect every important conclusion.

Use a structured database or equivalent reproducible files to store:

- Source catalog.
- Customer evidence.
- Quotes.
- Pain-point clusters.
- Competitor capabilities.
- Pricing.
- Provider requirements.
- Technical constraints.
- Opportunity scores.
- Rejected hypotheses.
- Unresolved questions.
- Experiment results.

Store original source URLs and verification status with every evidence record.

Create a consistent method for deduplication, evidence grading, and scoring. Document how to reproduce the reports from the underlying data.

Maintain a separation between verified evidence and analyst interpretation.

Keep Delecta's existing application and research assets intact. Conduct this work in a clearly separated research workspace or branch. Do not overwrite existing application files, switch branches destructively, or modify production code as part of research.

Before accessing paid services, spending money, contacting third parties, or making irreversible changes, identify the action and obtain the necessary approval.

---

## 11. Design validation experiments before building

Create a ranked validation plan with experiments that can be conducted without a finished product.

Possible experiments:

- Analyze complaints and feature requests from users of existing products.
- Interview target users about recent real examples of missed follow-ups and lost opportunities.
- Offer a manually delivered follow-up audit.
- Use sample inbox data or a consented test mailbox to demonstrate the workflow.
- Build a clickable mockup of the daily sales action dashboard.
- Offer a paid pilot using only provider-approved integrations.
- Test whether users will pay to solve one narrowly defined problem.
- Test whether users will grant the permissions required for the proposed solution.

For each experiment, specify:

- Hypothesis.
- Target participants.
- Recruitment method.
- Procedure.
- Cost.
- Duration.
- Success threshold.
- Failure threshold.
- Main confounding factors.
- Decision following each possible result.

Set thresholds before running the experiment.

Distinguish expressions of interest, free usage, repeated use, signed commitments, and actual payments.

Do not count survey enthusiasm as equivalent to purchase intent.

---

## 12. Define explicit go/no-go criteria

The research must end with a decision, not an endless list of opportunities.

Define gates for:

1. Evidence of a frequent and costly customer problem.
2. Evidence that existing products leave a meaningful gap.
3. Technical feasibility using supported provider integrations.
4. Policy and compliance feasibility.
5. Evidence of willingness to pay.
6. A reachable initial customer segment.
7. A narrow MVP that can be delivered without building an ESP.
8. A credible path to sustainable unit economics.

If a critical gate fails, identify the smallest alternative hypothesis worth testing.

If the research does not establish a viable opportunity, recommend stopping or narrowing the concept rather than inventing a justification for building it.

---

## 13. Required final deliverables

Produce the following artifacts:

1. Executive report with a clear recommendation.
2. Customer problem map with original evidence.
3. Verified competitor and capability matrix.
4. Current pricing comparison.
5. Gmail and Microsoft technical feasibility report.
6. Provider policy and compliance risk register.
7. Customer-segment ranking.
8. Ranked product hypotheses and rejection rationale.
9. Recommended initial product wedge.
10. MVP scope with explicit exclusions.
11. Architecture diagram and major dependencies.
12. Preliminary implementation and operating-cost estimates.
13. Customer acquisition hypothesis.
14. Validation experiment plan.
15. Predefined go/no-go scorecard.
16. Evidence database and source catalog.
17. A list of unresolved questions that materially affect the decision.

The executive report must answer:

- Is this a real opportunity?
- Who should we serve first?
- What is the one problem we should solve first?
- Why would someone buy this instead of using Gmail, Outlook, HubSpot, Instantly, or another existing product?
- Can we deliver the required workflow without becoming an ESP?
- Which provider permissions and policies could prevent launch?
- What can we test without writing production code?
- What is the smallest credible paid pilot?
- What evidence would convince us to stop?
- What should we do during the next 14 days?

End with one of three decisions:

**PROCEED:** Evidence supports a narrow product and a feasible validation path.

**VALIDATE FURTHER:** The problem appears credible, but critical assumptions remain unresolved.

**STOP OR PIVOT:** Existing products, technical restrictions, weak willingness to pay, or poor economics undermine the concept.

---

## 14. Research execution protocol

Work in phases.

**Phase 1 — Discovery:** Map customer problems, existing workflows, and relevant products.

**Phase 2 — Verification:** Inspect original sources, validate competitor claims, and confirm official provider requirements.

**Phase 3 — Synthesis:** Cluster problems, compare alternatives, score opportunities, and actively reject weak hypotheses.

**Phase 4 — Feasibility:** Investigate integrations, security, policies, architecture, and operating costs.

**Phase 5 — Validation design:** Create experiments with predefined success and failure criteria.

**Phase 6 — Decision:** Produce the deliverables and make a defensible go/no-go recommendation.

At the end of each phase, record what has been established, what remains unknown, and what evidence would change the recommendation.

Use explicit research limits and track coverage. If evidence is insufficient, state that fact rather than presenting incomplete research as exhaustive.

Do not begin product implementation until the decision gates justify it.

### Final instruction

Optimize for decision quality, not the number of pages, features, or citations.

We are not trying to prove that an email-centric sales platform can be built. We are trying to determine whether there is a specific, commercially valuable problem that we can solve better than existing products, with manageable technical risk and a realistic path to customers.

The final recommendation must be supported by inspectable evidence, adversarial analysis, and a practical next step.
