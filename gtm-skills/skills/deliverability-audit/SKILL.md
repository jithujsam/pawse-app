---
name: deliverability-audit
description: Audit cold-email sending domains for free (MX, SPF, DKIM, DMARC) with the bundled dns_check.py script and return a scored report with exact DNS fixes. Use when the user asks why emails land in spam, to check domain setup, SPF/DKIM/DMARC, sending infrastructure health, or wants a free deliverability report for a prospect or client.
---

# Deliverability Audit

Goal: a plain-English report that says what is broken, why it matters, and the exact record to add.

## Run it
```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/dns_check.py acme.com acme-mail.com
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/dns_check.py --file domains.txt --json > audit.json
```
Uses Google's public DNS-over-HTTPS API. Standard library only; no keys.

## Interpret
| Check | Fail means | Fix |
|---|---|---|
| MX | Replies bounce | Add the mail provider's MX records |
| SPF | Receivers can't verify sender | One TXT: `v=spf1 include:<provider> ~all`; merge duplicates; stay ≤ 10 lookups |
| DMARC | Gmail/Yahoo bulk-sender rules not met | TXT at `_dmarc`: `v=DMARC1; p=none; rua=mailto:dmarc@<domain>`; move to `quarantine` after 2-4 clean weeks |
| DKIM | Messages unsigned | Enable DKIM in the mail provider and publish its key; the script only checks common selectors, so confirm a custom selector in the provider before calling it missing |

Also advise, from the user's own data where possible:
- Send cold email from secondary domains, never the main one.
- About 30 cold emails per inbox per day; warm up new inboxes 2-3 weeks.
- Bounce rate under 2%; verify lists first.

## Output
A table per domain (check, status, finding, fix), the overall score, and the top 3 actions in order. Keep it short enough to paste into an email: this report doubles as a free value-first opener for prospects who run cold email.
