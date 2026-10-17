# Method: how evidence is collected, graded, scored and reproduced

This workspace answers the brief in `EMAIL_CENTRIC_SALES_PLATFORM_RESEARCH_PROMPT.md`. It is a bounded pilot, not
an exhaustive study. Coverage limits are stated in `reports/00_EXECUTIVE_REPORT.md`.

## Layout

| Path | What it is | Edited by |
|---|---|---|
| `findings/*.jsonl` | **Source of truth.** One JSON record per line (formats below). | Researchers / analyst |
| `snapshots/<sha256>.gz` | Raw copy of every page a quote or excerpt was taken from. | `rdb.py snap` only |
| `schema.sql`, `rdb.py` | Database schema and CLI (Python standard library only). | — |
| `synthesis.py` | Generates `findings/ws5-synthesis.jsonl` (hypotheses, scores, gates, experiments). | Analyst |
| `research.db` | Build product, not committed. Rebuild any time. | `rdb.py build` only |
| `reports/generated/*.md` | Tables rendered straight from the database: sources, facts, matrix, pricing, evidence, clusters, scores, risks, unknowns, gates. | `rdb.py render` only |
| `reports/*.md` | Analyst interpretation. Every claim cites `E<id>` (customer evidence), `F<id>` (documented fact) or says **inference** / **assumption** / **unknown**. | Analyst |

## Reproduce

```bash
python3 research/synthesis.py      # regenerate the analyst layer (only after editing synthesis.py)
python3 research/rdb.py build    # recreate research.db from findings/*.jsonl and re-verify every quote against its snapshot
python3 research/rdb.py render   # regenerate reports/generated/*.md
python3 research/rdb.py stats    # coverage counts
```

IDs (`E12`, `F40`, `S7`) are assigned in build order and stay stable as long as findings files are only appended to.
Records may also carry a `ref` (a unique, readable key such as `g-gmail-scopes-restricted`). Capability,
score, risk and gate records cite facts/evidence by these refs; `render` turns them into `F`/`E` ids and marks
any ref that points nowhere as `(missing)`.

## Evidence standard

1. **A search result is a lead, never evidence.** Only text read on the original page counts.
2. **Every quote/excerpt is checked mechanically.** `build` marks a record `verified` only if every fragment of the
   quote (fragments may be joined by `...`) appears, after normalising case and punctuation, in the saved snapshot of
   that URL. No snapshot = `unverified`. Text not found = `not_found`. Reports use only verified records.
3. **Customer evidence** (`evidence`) = what a real user wrote. Vendor marketing is never customer evidence.
4. **Facts** (`facts`) = what an official provider or vendor document states (policies, API limits, pricing,
   capabilities). `excerpt` is verbatim; `claim` is the analyst's reading and may be wrong. Where the document
   is ambiguous for our use case the claim says so.
5. **Deduplication.** URLs are canonicalised (tracking params, Reddit slugs, `www/old/m.`). The same quote on two pages
   counts once (`duplicate_of`). Several posts by one author count as one voice (`author_key`).
6. **Signal grading** (`signal_type`), weakest to strongest for willingness to pay:
   `opinion` < `behaviour` / `workaround` < `existing_spend` / `churn` < `stated_wtp`. `satisfied` is a user saying an
   existing tool solves it, which counts **against** the opportunity. Only payments count as proof of willingness to pay.
   None was observed in desk research.
7. **First-hand** (`first_hand: true`) only when the author describes their own work.
8. **Confidence**: `high` = first-hand, specific, recent (≤ 3 years) and verified. `medium` = two of those. `low` = otherwise.

## Scoring

Hypotheses (segments, wedges, architectures, pricing models) are scored **0–3 per criterion**:
0 = evidence against / clearly bad, 1 = weak, 2 = adequate, 3 = strong. Each score records its `basis`:
`fact` (cites E/F ids), `inference` (reasoned from facts, shown with `*`) or `unknown` (no evidence: scored 1 by
convention, so missing evidence never looks like a strength). Totals are a summary only. A hypothesis with a 0 on a
critical criterion (provider policy, problem severity) is rejected whatever its total.

## Record formats (`findings/*.jsonl`)

All records have `"kind"`. Optional fields may be omitted. Sources can be given inline as `"source": {...}` or just `"url"`.

```jsonc
{"kind":"run","id":"ws1-provider","phase":"feasibility","workstream":"provider","agent":"researcher-1"}
{"kind":"query","run_id":"ws1-provider","tool":"websearch","query":"gmail api restricted scope security assessment","result_count":10}
{"kind":"source","url":"https://...","source_type":"official_doc","title":"...","published_at":"2025-03-01","retrieved_at":"2026-10-17T05:00:00Z",
 "access_method":"fetch","http_status":200,"snapshot_sha256":"<from rdb.py snap>","is_vendor_content":false}
{"kind":"fact","run_id":"ws1-provider","url":"https://...","subject":"google","topic":"oauth.restricted_scope",
 "claim":"Reading message bodies needs a restricted scope, which triggers an annual third-party security assessment.",
 "excerpt":"<verbatim, <=600 chars>","value":"yes","as_of":"2026-10-17","ref":"g-restricted-casa"}
{"kind":"capability","product":"streak","capability":"sequences","value":"partial","detail":"...","fact_ids":"streak-mailmerge-followups,streak-pricing-pro"}
{"kind":"cluster","slug":"missed-followups","workflow_area":"C","title":"...","problem_statement":"..."}
{"kind":"evidence","run_id":"ws3-customer","url":"https://reddit.com/r/sales/comments/abc123","segment":"founder","workflow_area":"C",
 "author_key":"reddit:u_xyz","quote":"<verbatim, <=300 chars>","problem":"...","workaround":"spreadsheet + calendar reminders",
 "tools_mentioned":"HubSpot free","frequency_signal":"daily","severity_signal":"lost a $20k deal","spend_signal":null,
 "first_hand":true,"signal_type":"workaround","competitor":"hubspot","confidence":"medium","limitations":"...","clusters":["missed-followups"]}
{"kind":"link","url":"https://...","quote":"<existing quote>","cluster":"missed-followups","stance":"against"}
{"kind":"hypothesis","slug":"seg-founder","htype":"segment","title":"Founders doing their own B2B sales","statement":"...","status":"open"}
{"kind":"score","hypothesis":"seg-founder","criterion":"severity","score":2,"basis":"fact","rationale":"...","refs":"E3,E9"}
{"kind":"risk","slug":"google-casa","area":"google","risk":"...","likelihood":"high","impact":"high","refs":"F4","mitigation":"...","needs_provider_clarification":true}
{"kind":"unknown","slug":"perm-grant-rate","question":"...","why_it_matters":"...","gate":3,"resolve_by":"exp-permission-test"}
{"kind":"experiment","slug":"...","rank":1,"hypothesis":"...","success":"...","failure":"...", "...":"..."}
{"kind":"gate","id":4,"name":"Policy and compliance feasibility","pass_criterion":"...","status":"conditional","rationale":"...","refs":"F2,F7"}
```

Hypothesis records use `"htype"` for their type (`segment | wedge | architecture | pricing`), because `kind` is taken.

### Vocabularies

- `workflow_area`: A prospect discovery/lists · B initial outreach/personalisation · C follow-up scheduling/execution ·
  D inbox triage/prioritisation · E reply classification/next action · F conversation & deal context ·
  G meetings/proposals/negotiation · H stalled deals & missed commitments · I SDR/AE/founder handoffs ·
  J pipeline reporting/manager visibility · K relationship history/promises · L CRM data entry & sync ·
  M deliverability/limits/permissions/mailboxes.
- `segment`: `founder`, `small_team` (3–10 reps), `ae`, `sdr`, `agency`, `consultant`, `no_crm_smb`, `crm_laggard`, `unknown`.
- Capability slugs (matrix columns): `gmail`, `outlook`, `inside_inbox`, `prospect_data`, `sequences`, `reply_autostop`,
  `thread_to_deal`, `pipeline`, `stalled_alerts`, `tasks_reminders`, `ai_writing`, `ai_next_action`, `team_visibility`,
  `sends_via_user_mailbox`, `own_send_infra`, `free_plan`, `api`.
- Fact `topic` prefixes: `policy.*`, `oauth.*`, `api.*` (capabilities/limits), `admin.*`, `security.*`, `legal.*`,
  `pricing.*`, `capability.<slug>`, `positioning`.

## Budget for this pilot (caps, not targets)

| Workstream | Queries | Page fetches | Records |
|---|---|---|---|
| WS1 Provider feasibility (Google, Microsoft, law) | 25 | 45 | ≤ 90 facts |
| WS2 Competitors & pricing (≈ 20 products) | 30 | 60 | ≤ 160 facts, full capability matrix |
| WS3 Customer evidence (workflow pain + counter-evidence) | 30 | 50 | ≤ 80 evidence items |

## Access notes (tested 2026-10-17)

- Work: official Google/Microsoft docs, vendor pricing and help pages, HN (Algolia API), Capterra review pages
  (review text embedded as JSON), Reddit **through the Arctic Shift archive** (`rdb.py snap <reddit thread URL>`).
  The archive sometimes answers "Timeout. Maybe slow down a bit"; `snap` backs off and retries.
- Blocked by the sites themselves: G2, TrustRadius (HTTP 403), Reddit direct (login redirect). Their content is
  used only if the same text can be read and snapshotted elsewhere. Otherwise it is recorded as an unverified lead.
