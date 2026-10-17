# Gmail and Microsoft feasibility (deliverables 5 and 6)

Sources: official Google, Microsoft and regulator pages only. 76 facts, all verified against saved page copies
(`generated/FACTS.md`). The risk register is in `generated/RISK_REGISTER.md`, and open questions are in `generated/UNKNOWNS.md`.
Citations: `F<n>` = documented fact. Anything else is labelled **inference** or **unknown**.

## Bottom line

1. **Connecting, reading, threading, detecting replies, drafting and sending are all officially supported** on both
   providers through OAuth APIs. No IMAP/SMTP or stored passwords are needed. Google retired password-based "less secure apps" (F46), and
   IMAP/SMTP access counts as the restricted full-mail scope anyway (F17).
2. **The cost is permissions, not APIs.**
   - **Google:** any server-side read of Gmail, even headers only, uses a *restricted* scope (F3, F13). That
     requires restricted-scope verification plus an **annual third-party security assessment (CASA)** (F14, F15, F18).
     Verification "might require several months" (F23). Until verified, the app is capped at **100 users in total** (F23).
     The cost of CASA is not published (**unknown**, `casa-cost`).
   - **Microsoft:** under the "Microsoft managed" consent policy, which is the default for new tenants, users **cannot consent to
     `Mail.Read`, `Mail.ReadBasic` or `Mail.ReadWrite`** (F54). A tenant admin must consent. `Mail.Send` stays
     user-consentable. Publisher verification is free and effectively required (F56).
3. **Automated cold outreach through a connected mailbox is a no-go.** Google's developer policy does not approve
   Gmail scopes for "applications that distribute spam or unsolicited commercial mail". It approves bulk mail from CRMs only
   "as long as the user consented to receive emails" (F9). The Gmail Program Policies say "Don't use Gmail to distribute
   spam or unsolicited commercial mail" (F40), and so does the Workspace AUP (F42). None of these sets a volume threshold, so
   30-50 emails/day is not exempt (**inference** from the absence of any threshold). Google may revoke API access if an app
   *enables users* to violate its policies (F7), so a single customer's misuse puts the whole product at risk. Microsoft
   says Exchange Online "isn't suited to accommodate bulk-mailing scenarios" (F65).
4. **Ordinary correspondence, CRM use and human-reviewed drafting are explicitly approved uses.** Gmail's approved
   use cases list "applications that enhance the email experience for productivity purposes (such as applications for
   customer relationship management, delayed sending of email or mail merge, or providing generative AI summaries)" (F8).

## Go / no-go by use case

| Use case | Google | Microsoft | Verdict |
|---|---|---|---|
| (a) Automated first-touch outreach to prospects who never opted in | Not an approved use (F9, F40, F42); app-wide revocation risk (F7) | Not for bulk (F65); tenant external-recipient cap (F66) | **No-go.** Wording on "the user consented" needs written clarification from Google (`google-cold-outreach-classification`). |
| (b) Automated follow-ups in a thread that started cold | Technically supported (F33). Policy silent on whether it is "unsolicited" | Supported (F62) | **Unresolved.** Treat as (a) until clarified (`google-followup-classification`). |
| (b') Follow-ups to contacts who have replied / are in an active deal | Approved CRM use (F8) | Supported | **Go.** |
| (c) 1:1 business correspondence, reading and organising threads | Approved (F8); restricted scope + CASA (F14) | Mail.Read needs admin consent (F54) | **Go, with verification cost.** |
| (d) AI drafts for human review and sending | Gmail add-on scopes can do this without CASA (F47, F48); server-side drafts need restricted `gmail.compose` (F3) | createReply needs Mail.ReadWrite (admin) (F62, F54) | **Go.** |

Legal layer (B2B email to prospects):
- **US (CAN-SPAM):** opt-out regime with content requirements (F70, F71).
- **UK (PECR):** cold email to corporate bodies is allowed, but soft opt-in does not cover prospects (F72, F73).
- **Canada (CASL):** consent required (F74).
- **EU:** not retrieved (**unknown**, `eu-b2b-email-law`).
- **India (DPDP Act):** an India-based processor of mailbox data falls under the DPDP Act. Its rules were notified on 14 Nov 2025 with an 18-month phase-in (F75), and they include breach-notification duties (F76).

## Feasibility matrix

| Question | Google Gmail / Workspace | Microsoft Outlook / M365 |
|---|---|---|
| Can we connect? | OAuth 2.0 only (F46, F17). | OAuth via Microsoft Graph; basic auth off (F69). |
| Can we read and organise conversations? | Yes, with a restricted scope (`gmail.readonly`/`gmail.metadata`/`gmail.modify`) (F3, F13). That requires verification + annual CASA (F14, F15, F18). Must follow Limited Use: no ad use, no training generalised models on customer mail, and humans may read mail only with consent or for security (F10, F11, F12). | Yes: `Mail.ReadBasic` (no bodies) or `Mail.Read` (F49, F50). Admin consent needed in tenants on the Microsoft-managed policy (F54). |
| Can we send? | `gmail.send` is *sensitive*, not restricted: verification but no CASA (F2). Limits: 2,000 msgs/day, 3,000 external recipients/day per Workspace user, 24 h block when exceeded (F28, F29). | `Mail.Send` user-consentable (F52). `sendMail` returns 202, which does not confirm delivery (F61). 10,000 recipients/day, 30 msgs/min (F64), plus a tenant external-recipient cap (F66). The per-mailbox 2,000/day limit was cancelled on 6 Jan 2026 (F67). |
| Can we schedule follow-ups? | Yes. Server-side scheduler sends in-thread with `threadId` + `In-Reply-To`/`References` headers and a matching subject (F33). Needs reply detection to cancel, so restricted scope. | Yes, via createReply draft then send (F62). Needs Mail.ReadWrite (admin consent). |
| Can we detect replies? | `users.watch` → Cloud Pub/Sub, renewed at least every 7 days, plus `history.list` incremental sync (F31). Full re-sync on history 404 (F32). Restricted scope. Pub/Sub cost negligible (F201). | Change-notification subscriptions with lifetime < 7 days, renewed (F58). Need Mail.Read(Basic) (F59). Per-folder delta query (F60). |
| Can we associate messages with deals? | `threadId`, `Message-ID`, `References`, participants; restricted scope (F13, F33). Matching logic is ours (**inference**). | `conversationId`, `internetMessageId`; `Mail.ReadBasic` suffices (F50). |
| Can we serve paying SaaS customers? | Yes, after verification: demo video, least-privilege justification, annual CASA (F19, F20, F21). Under 100 users unverified (F23). Workspace admins can block or limit the app or specific scopes (F44, F45). Gmail API usage billing above 80M units/day/project from 2026 (F25), price unpublished. | Yes: multitenant app + publisher verification (F56). M365 Certification optional, but some tenants require it (F57). Throttling per app per mailbox (F63). |
| What can block launch? | Restricted verification rejection or delay; CASA cost; policy breach by a customer → app-wide revocation (F7); admin blocks (F44). | Admin consent in every new tenant (F54); IT refusal at larger companies (E11, E20); future adaptive bulk controls (F67, `ms-adaptive-bulk-controls`). |

## Cheapest compliant technical path (inference from the facts above)

1. **v0, no mailbox scopes:** a concierge service, plus possibly a CRM-API-only variant that reads emails the CRM
   already logs. Whether HubSpot/Pipedrive APIs expose enough thread content is **unknown** (`crm-logged-email-sufficient`)
   and was not checked in this pilot.
2. **v1 Google:** run on restricted scopes as an *unverified* app for up to 100 users (F23) while applying for
   verification. Position and demo the app strictly as CRM / productivity (F8), with no sending features. That keeps the
   restricted-scope review away from the "sequencer" category (risk `google-verification-usecase-review`).
3. **v1 Microsoft:** target tenants where the buyer is the admin. Ask for `Mail.ReadBasic` first (metadata is enough for
   association and reply detection, F50) and `Mail.Read` only for AI drafting.
4. **A Gmail add-on alone cannot be the product.** Its scopes give access only to the message the user has open (F47), so
   it cannot detect replies or watch deals in the background. It suits only the human-in-the-loop drafting surface.

## Technical requirements carried into the MVP

| Requirement | How it is met |
|---|---|
| Tokens | OAuth refresh tokens encrypted at rest; per-tenant keys; revocation handled on `invalid_grant` / consent removal. |
| Reply detection | Gmail watch + history sync, Graph subscriptions + delta; renew before expiry; nightly full reconciliation because notifications can be dropped (F31, F32, F58). |
| Duplicates / retries | Message identity = provider id + RFC `Message-ID`; idempotent ingestion; exponential backoff on 429 (F24, F63). |
| Data minimisation | Store metadata + derived deal facts; avoid permanent copies of bodies (Google API ToS on caching, F43). Do not train shared models on customer mail (F10). |
| Sending (later, not v1) | Only within existing threads with engaged contacts; per-user caps far below F28/F64; one-click unsubscribe where messages could be commercial (F39); a suppression list across all senders (F71). |
| India / international | DPDP notice and consent, breach notification (F75, F76); a data processing agreement for EU/UK customers (**inference**). |
