-- Evidence store for the email-centric sales platform research (see EMAIL_CENTRIC_SALES_PLATFORM_RESEARCH_PROMPT.md).
-- research.db is a build product: `python3 research/rdb.py build` recreates it from findings/*.jsonl.
PRAGMA foreign_keys = ON;

-- Batches of work, so every record can be traced to the workstream that produced it.
CREATE TABLE IF NOT EXISTS runs (
  id          TEXT PRIMARY KEY,               -- e.g. 'ws1-provider-feasibility'
  phase       TEXT NOT NULL,                  -- discovery | verification | synthesis | feasibility | validation | decision
  workstream  TEXT,                           -- provider | competitor | customer | synthesis
  agent       TEXT,
  notes       TEXT
);

-- Every search, so the budget can be counted and queries are not repeated.
CREATE TABLE IF NOT EXISTS queries (
  id           INTEGER PRIMARY KEY,
  run_id       TEXT REFERENCES runs(id),
  tool         TEXT NOT NULL,                 -- websearch | arctic_shift | hn_algolia | ...
  query        TEXT NOT NULL,
  result_count INTEGER,
  UNIQUE (tool, query)
);

-- One row per page actually retrieved (or seen only through a search summary).
CREATE TABLE IF NOT EXISTS sources (
  id              INTEGER PRIMARY KEY,
  canonical_url   TEXT NOT NULL UNIQUE,
  url             TEXT NOT NULL,
  domain          TEXT NOT NULL,
  source_type     TEXT NOT NULL,              -- official_doc | official_policy | pricing_page | vendor_doc | vendor_blog
                                              -- | reddit | hn | forum | review_site | marketplace | job_post | report | other
  title           TEXT,
  published_at    TEXT,                       -- as stated on the page; NULL if not shown
  retrieved_at    TEXT,                       -- NULL when only seen through a search summary
  access_method   TEXT NOT NULL,              -- fetch | webfetch | websearch_only
  http_status     INTEGER,
  snapshot_sha256 TEXT,                       -- snapshots/<sha>.gz
  is_vendor_content INTEGER NOT NULL DEFAULT 0, -- vendor copy is never customer evidence
  notes           TEXT
);

-- Customer evidence: what real users say about the workflow. Quotes <= 300 chars (enforced by rdb.py).
CREATE TABLE IF NOT EXISTS evidence (
  id                INTEGER PRIMARY KEY,
  source_id         INTEGER NOT NULL REFERENCES sources(id),
  run_id            TEXT REFERENCES runs(id),
  segment           TEXT NOT NULL,            -- founder | small_team | ae | sdr | agency | consultant | no_crm_smb | crm_laggard | unknown
  workflow_area     TEXT NOT NULL,            -- A..M from prompt section 3
  author_key        TEXT,                     -- username / reviewer id; NULL if unknown
  quote             TEXT NOT NULL,
  quote_hash        TEXT NOT NULL,
  problem           TEXT NOT NULL,
  workaround        TEXT,
  tools_mentioned   TEXT,
  frequency_signal  TEXT,
  severity_signal   TEXT,
  spend_signal      TEXT,
  first_hand        INTEGER NOT NULL DEFAULT 1, -- 1 = describes own experience, 0 = general opinion
  signal_type       TEXT NOT NULL CHECK (signal_type IN
                      ('opinion','behaviour','workaround','existing_spend','stated_wtp','churn','satisfied','vendor_claim')),
  competitor        TEXT,
  confidence        TEXT NOT NULL CHECK (confidence IN ('low','medium','high')),
  limitations       TEXT,
  verification      TEXT NOT NULL DEFAULT 'unverified' CHECK (verification IN ('unverified','verified','not_found')),
  verified_at       TEXT,
  duplicate_of      INTEGER REFERENCES evidence(id),
  UNIQUE (source_id, quote_hash)
);

-- Facts from official / vendor documentation: provider requirements, product capabilities, pricing.
-- `excerpt` is verbatim from the page and is checked by `verify`; `claim` is the analyst's reading of it.
CREATE TABLE IF NOT EXISTS facts (
  id           INTEGER PRIMARY KEY,
  source_id    INTEGER NOT NULL REFERENCES sources(id),
  run_id       TEXT REFERENCES runs(id),
  subject      TEXT NOT NULL,                 -- google | microsoft | hubspot | instantly | ... (lower-case slug)
  topic        TEXT NOT NULL,                 -- e.g. policy.bulk_mail, oauth.restricted_scope, api.quota, pricing, capability.sequences
  claim        TEXT NOT NULL,
  excerpt      TEXT NOT NULL,
  excerpt_hash TEXT NOT NULL,
  value        TEXT,                          -- structured value: yes | no | partial | a price | a limit
  as_of        TEXT,                          -- date the page was read
  verification TEXT NOT NULL DEFAULT 'unverified' CHECK (verification IN ('unverified','verified','not_found')),
  verified_at  TEXT,
  UNIQUE (source_id, excerpt_hash)
);

-- Capability matrix cell: product x capability, each value backed by fact ids (or marked unknown).
CREATE TABLE IF NOT EXISTS capabilities (
  product     TEXT NOT NULL,
  capability  TEXT NOT NULL,                  -- the 17 dimensions of prompt section 4, as slugs
  value       TEXT NOT NULL CHECK (value IN ('yes','partial','no','unknown','n/a')),
  detail      TEXT,
  fact_ids    TEXT,                           -- comma-separated facts.id; empty only when value = unknown
  PRIMARY KEY (product, capability)
);

-- Pain-point clusters built from evidence.
CREATE TABLE IF NOT EXISTS clusters (
  id          INTEGER PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  workflow_area TEXT,
  title       TEXT NOT NULL,
  problem_statement TEXT,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','shortlisted','rejected')),
  rejection_reason TEXT
);

CREATE TABLE IF NOT EXISTS cluster_evidence (
  cluster_id  INTEGER NOT NULL REFERENCES clusters(id),
  evidence_id INTEGER NOT NULL REFERENCES evidence(id),
  stance      TEXT NOT NULL DEFAULT 'supports' CHECK (stance IN ('supports','against')),
  PRIMARY KEY (cluster_id, evidence_id)
);

-- Competing hypotheses: segments, wedges, architectures, pricing models. Rejections are kept, never deleted.
CREATE TABLE IF NOT EXISTS hypotheses (
  slug        TEXT PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('segment','wedge','architecture','pricing')),
  title       TEXT NOT NULL,
  statement   TEXT,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','shortlisted','selected','rejected')),
  rejection_reason TEXT
);

-- Scores (0-3) per hypothesis and criterion; basis says whether the score rests on fact, inference or nothing.
CREATE TABLE IF NOT EXISTS scores (
  hypothesis   TEXT NOT NULL REFERENCES hypotheses(slug),
  criterion    TEXT NOT NULL,
  score        INTEGER NOT NULL CHECK (score BETWEEN 0 AND 3),
  basis        TEXT NOT NULL CHECK (basis IN ('fact','inference','unknown')),
  rationale    TEXT NOT NULL,
  refs         TEXT,                          -- e.g. 'E12,E40,F7' (E = evidence id, F = fact id)
  PRIMARY KEY (hypothesis, criterion)
);

-- Policy / compliance / technical risk register.
CREATE TABLE IF NOT EXISTS risks (
  slug        TEXT PRIMARY KEY,
  area        TEXT NOT NULL,                  -- google | microsoft | legal | deliverability | security | commercial
  risk        TEXT NOT NULL,
  likelihood  TEXT NOT NULL CHECK (likelihood IN ('low','medium','high')),
  impact      TEXT NOT NULL CHECK (impact IN ('low','medium','high','launch_blocking')),
  refs        TEXT,
  mitigation  TEXT,
  needs_provider_clarification INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS unknowns (
  slug        TEXT PRIMARY KEY,
  question    TEXT NOT NULL,
  why_it_matters TEXT NOT NULL,
  gate        INTEGER,                        -- go/no-go gate it affects (1-8)
  resolve_by  TEXT,                           -- experiment slug or action
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved'))
);

CREATE TABLE IF NOT EXISTS experiments (
  slug        TEXT PRIMARY KEY,
  rank        INTEGER NOT NULL,
  hypothesis  TEXT NOT NULL,
  participants TEXT, recruitment TEXT, procedure TEXT, cost TEXT, duration TEXT,
  success     TEXT NOT NULL,                  -- thresholds fixed before running
  failure     TEXT NOT NULL,
  confounders TEXT,
  decisions   TEXT,
  status      TEXT NOT NULL DEFAULT 'designed' CHECK (status IN ('designed','running','passed','failed','ambiguous')),
  result      TEXT
);

CREATE TABLE IF NOT EXISTS gates (
  id          INTEGER PRIMARY KEY,            -- 1-8 from prompt section 12
  name        TEXT NOT NULL,
  pass_criterion TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('pass','fail','unresolved','conditional')),
  rationale   TEXT NOT NULL,
  refs        TEXT
);

-- Usable evidence = verified, not a duplicate, not vendor content.
CREATE VIEW IF NOT EXISTS v_usable_evidence AS
SELECT e.*, s.domain, s.source_type, s.canonical_url, s.published_at
FROM evidence e JOIN sources s ON s.id = e.source_id
WHERE e.verification = 'verified' AND e.duplicate_of IS NULL AND s.is_vendor_content = 0;

CREATE VIEW IF NOT EXISTS v_verified_facts AS
SELECT f.*, s.canonical_url, s.source_type, s.title AS source_title
FROM facts f JOIN sources s ON s.id = f.source_id WHERE f.verification = 'verified';

-- Independent voices per cluster: one author counts once, however often they post.
CREATE VIEW IF NOT EXISTS v_cluster_strength AS
SELECT c.slug, c.workflow_area, c.status,
  COUNT(DISTINCT CASE WHEN ce.stance = 'supports' THEN COALESCE(u.author_key, 'src:' || u.source_id) END) AS independent_voices,
  COUNT(DISTINCT CASE WHEN ce.stance = 'supports' THEN u.domain END)                                     AS distinct_domains,
  COUNT(DISTINCT CASE WHEN ce.stance = 'supports' AND u.first_hand = 1 THEN COALESCE(u.author_key,'src:'||u.source_id) END) AS first_hand_voices,
  COUNT(DISTINCT CASE WHEN ce.stance = 'supports' AND u.signal_type IN ('existing_spend','churn','stated_wtp')
        THEN COALESCE(u.author_key,'src:'||u.source_id) END)                                             AS money_voices,
  COUNT(DISTINCT CASE WHEN ce.stance = 'against' THEN COALESCE(u.author_key,'src:'||u.source_id) END)   AS against_voices
FROM clusters c
LEFT JOIN cluster_evidence ce ON ce.cluster_id = c.id
LEFT JOIN v_usable_evidence u ON u.id = ce.evidence_id
GROUP BY c.id;
