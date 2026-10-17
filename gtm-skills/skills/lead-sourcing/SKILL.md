---
name: lead-sourcing
description: Build a B2B lead list with zero paid data tools, using public sources (company websites, team pages, job boards, Google search, GitHub, directories, Apollo/Hunter free tiers) plus the bundled email_guess.py script for email patterns. Use when the user needs leads, contacts, a prospect list, decision-maker emails, or wants to replace a paid enrichment tool, and has no Apollo, Clay or ZoomInfo budget.
---

# Lead Sourcing (free stack)

Goal: a CSV of the right companies and the right person at each, with a best-guess email and a source for every fact.

## Inputs
- An ICP (run `icp-builder` first if there isn't one)
- Target count (default 100; quality over volume)

## Step 1: Find companies
Use the free source that matches the ICP. Record the source URL for every company.

| ICP type | Free source |
|---|---|
| Tech / SaaS | Google: `site:linkedin.com/company "<keyword>" "11-50 employees"`, Product Hunt, G2 category pages, YC company directory, BuiltWith free lookups, GitHub orgs |
| Hiring signal | Job boards (LinkedIn Jobs, Wellfound, company careers pages): companies hiring the role that feels the pain |
| Agencies / services | Clutch, agency directories, Google: `"<service> agency" "<city>"` |
| Local businesses | Google Maps category + city, Yelp, industry associations |
| Funding signal | Public funding announcements, Crunchbase news pages, TechCrunch |

Respect each site's terms and robots.txt. Prefer reading pages over bulk-scraping; small careful volumes are enough for outbound.

## Step 2: Find the person
For each company, find the persona from the ICP:
1. Company team/about page
2. Google: `site:linkedin.com/in "<company>" "<title>"`
3. Press releases, podcasts, conference speaker pages
4. Apollo free tier and Hunter free tier for the remaining gaps (monthly credits are limited; spend them on best-fit accounts only)

Record `first_name, last_name, title, company, domain, source_url`.

## Step 3: Email
1. Look for any real address at the domain (website, press page, GitHub commits). If found, use it to lock the pattern.
2. Run the bundled script:
   ```bash
   python3 ${CLAUDE_PLUGIN_ROOT}/scripts/email_guess.py leads.csv -o leads_with_emails.csv
   # with a known pattern:
   python3 ${CLAUDE_PLUGIN_ROOT}/scripts/email_guess.py leads.csv --known jane.doe@acme.com --known-name "Jane Doe"
   ```
3. Tell the user: guesses must pass a verifier (Instantly/Smartlead built-in checks, or a free-tier verifier) before sending. Never send to unverified guesses from a main domain.

## Output
CSV columns: `company, domain, first_name, last_name, title, source_url, trigger, email_best_guess, email_alternatives, email_confidence, domain_accepts_mail`

End with: count found, count with confirmed patterns, gaps, and the suggestion to run `lead-scoring`.

## Rules
- Never fabricate a person, title or email. Empty is better than invented.
- Every row needs a `source_url`.
- Personal (gmail, etc.) addresses are out of scope for B2B outreach.
- Follow anti-spam law for the recipient's country (CAN-SPAM, GDPR legitimate interest, CASL). Flag EU/Canada contacts.
