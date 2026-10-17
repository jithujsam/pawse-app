# gtm-skills

Outbound GTM engineering inside Claude Code, on a free data stack.

Seven skills that take you from a company URL to a scored, personalised, ready-to-send campaign, without Clay, Apollo paid plans or ZoomInfo.

| Skill | What it does |
|---|---|
| `icp-builder` | Website URL → ICP, personas, triggers, search filters for free sources |
| `lead-sourcing` | Builds a lead list from public sources + free tiers, guesses emails with `email_guess.py` |
| `lead-scoring` | Scores every lead 0-100 against the ICP with a reason |
| `first-lines` | Researched, sourced first lines, one per lead |
| `cold-sequence` | 3-email sequence + subjects, import-ready CSV for Instantly / Smartlead |
| `deliverability-audit` | Free MX / SPF / DKIM / DMARC audit with `dns_check.py` and exact fixes |
| `clay-migration` | Rebuilds a Clay table as a Claude Code workflow with a cost comparison |

## Install

As a Claude Code plugin, once this folder is published as its own GitHub repo:

```
/plugin install gtm-skills --marketplace <owner>/<repo>
```

From a local clone:

```bash
claude plugin marketplace add ./gtm-skills
claude plugin install gtm-skills
```

Or copy the skill folders into `~/.claude/skills/` (all projects) or `.claude/skills/` (one project).

## Use

Just ask in plain language; Claude picks the skill:

```
Build an ICP for https://example.com
Find 50 leads that match this ICP
Score leads.csv and give me the top 20
Write first lines for tier A leads
Write a 3-step sequence for this offer
Audit deliverability for acme.com and acme-mail.com
Here's my Clay table export, rebuild it in Claude Code
```

## Scripts

Standard-library Python 3.9+, no API keys.

```bash
python3 scripts/dns_check.py acme.com acme-mail.com
python3 scripts/email_guess.py leads.csv -o leads_with_emails.csv
```

`email_guess.py` never contacts mail servers. Verify guesses before sending.

## Principles

- Never invent a person, fact or email. Empty beats wrong.
- Every fact has a source URL.
- Deliverability first: secondary domains, warmed inboxes, verified lists.
- Follow CAN-SPAM, GDPR and CASL for the recipient's country.

## License

MIT
