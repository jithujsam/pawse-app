-- Evidence store for SaaS opportunity research.
-- Every statement is idempotent: running this file again never drops or duplicates data.
PRAGMA foreign_keys = ON;

-- Batches of work (pilot pass, deep pass, skeptic review) so results can be traced and resumed.
CREATE TABLE IF NOT EXISTS runs (
  id          TEXT PRIMARY KEY,               -- e.g. 'pilot-2026-10-bookkeeping'
  phase       TEXT NOT NULL,                  -- discovery | competitor | challenge | scoring
  segment     TEXT,
  agent       TEXT,                           -- which researcher produced it
  started_at  TEXT NOT NULL DEFAULT (datetime('now')),
  notes       TEXT
);

-- Results of live access probes; SOURCE_CATALOG.md is generated from this table.
CREATE TABLE IF NOT EXISTS access_checks (
  id          INTEGER PRIMARY KEY,
  source_name TEXT NOT NULL,
  url         TEXT NOT NULL,
  method      TEXT NOT NULL,                  -- shell_http | websearch | webfetch
  outcome     TEXT NOT NULL,                  -- ok | proxy_denied | http_<code> | error
  detail      TEXT,
  checked_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Every search run, so the same query is not repeated and the budget can be counted.
CREATE TABLE IF NOT EXISTS queries (
  id          INTEGER PRIMARY KEY,
  run_id      TEXT REFERENCES runs(id),
  segment     TEXT,
  tool        TEXT NOT NULL,                  -- websearch | reddit_json | hn_algolia | ...
  query       TEXT NOT NULL,
  result_count INTEGER,
  run_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (tool, query)
);

-- URLs found by search but not yet read in full. A lead is never evidence on its own.
CREATE TABLE IF NOT EXISTS leads (
  id            INTEGER PRIMARY KEY,
  canonical_url TEXT NOT NULL UNIQUE,
  url           TEXT NOT NULL,
  segment       TEXT,
  query_id      INTEGER REFERENCES queries(id),
  search_claim  TEXT,                         -- what the search summary said; unverified by definition
  status        TEXT NOT NULL DEFAULT 'new'   -- new | fetched | unreachable | rejected
                CHECK (status IN ('new','fetched','unreachable','rejected')),
  found_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per page actually retrieved (or cited).
CREATE TABLE IF NOT EXISTS sources (
  id              INTEGER PRIMARY KEY,
  canonical_url   TEXT NOT NULL UNIQUE,
  url             TEXT NOT NULL,
  domain          TEXT NOT NULL,
  source_type     TEXT NOT NULL,              -- reddit | forum | review_site | app_store | feature_board
                                              -- | job_post | hn | github | vendor_site | vendor_blog | other
  title           TEXT,
  published_at    TEXT,                       -- as stated on the page; NULL if not shown
  retrieved_at    TEXT,                       -- NULL when only seen through a search summary
  access_method   TEXT NOT NULL,              -- fetch | api | websearch_only
  http_status     INTEGER,
  snapshot_sha256 TEXT,                       -- file in snapshots/<sha>.html.gz
  is_vendor_content INTEGER NOT NULL DEFAULT 0, -- marketing copy is never customer evidence
  notes           TEXT
);

-- Individual pieces of evidence. Quotes stay short (<= 300 chars, enforced by rdb.py).
CREATE TABLE IF NOT EXISTS evidence (
  id                INTEGER PRIMARY KEY,
  source_id         INTEGER NOT NULL REFERENCES sources(id),
  run_id            TEXT REFERENCES runs(id),
  segment           TEXT NOT NULL,
  author_key        TEXT,                     -- username / reviewer id; NULL if unknown
  quote             TEXT NOT NULL,
  quote_hash        TEXT NOT NULL,            -- hash of the normalised quote, for duplicate detection
  problem           TEXT NOT NULL,
  workaround        TEXT,
  frequency_signal  TEXT,                     -- e.g. 'every month-end'; NULL if none stated
  severity_signal   TEXT,
  spend_signal      TEXT,                     -- money or paid tools already in use, as stated
  signal_type       TEXT NOT NULL CHECK (signal_type IN
                      ('opinion','behaviour','workaround','existing_spend','stated_wtp','churn','vendor_claim')),
  competitor        TEXT,                     -- product the complaint is about, if any
  confidence        TEXT NOT NULL CHECK (confidence IN ('low','medium','high')),
  limitations       TEXT,
  verification      TEXT NOT NULL DEFAULT 'unverified'
                    CHECK (verification IN ('unverified','verified','not_found')),
  verified_at       TEXT,
  duplicate_of      INTEGER REFERENCES evidence(id),  -- set when the same quote appears elsewhere
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (source_id, quote_hash)
);

CREATE TABLE IF NOT EXISTS clusters (
  id          INTEGER PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  segment     TEXT NOT NULL,
  title       TEXT NOT NULL,
  problem_statement TEXT,
  status      TEXT NOT NULL DEFAULT 'open'
              CHECK (status IN ('open','shortlisted','rejected')),
  rejection_reason TEXT
);

CREATE TABLE IF NOT EXISTS cluster_evidence (
  cluster_id  INTEGER NOT NULL REFERENCES clusters(id),
  evidence_id INTEGER NOT NULL REFERENCES evidence(id),
  stance      TEXT NOT NULL DEFAULT 'supports' CHECK (stance IN ('supports','against')),
  PRIMARY KEY (cluster_id, evidence_id)
);

CREATE TABLE IF NOT EXISTS competitors (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  url           TEXT,
  segment       TEXT,
  pricing_text  TEXT,                         -- verbatim from the pricing page; NULL if unverified
  pricing_source_id INTEGER REFERENCES sources(id),
  notes         TEXT
);

-- Scores per cluster and criterion; every score must cite evidence ids.
CREATE TABLE IF NOT EXISTS scores (
  cluster_id   INTEGER NOT NULL REFERENCES clusters(id),
  criterion    TEXT NOT NULL,
  score        INTEGER NOT NULL CHECK (score BETWEEN 0 AND 3),
  basis        TEXT NOT NULL CHECK (basis IN ('fact','inference','unknown')),
  rationale    TEXT NOT NULL,
  evidence_ids TEXT,                          -- comma-separated evidence.id list
  scored_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (cluster_id, criterion)
);

-- Usable evidence = verified, not a duplicate, not vendor marketing.
CREATE VIEW IF NOT EXISTS v_usable_evidence AS
SELECT e.*, s.domain, s.source_type, s.canonical_url
FROM evidence e JOIN sources s ON s.id = e.source_id
WHERE e.verification = 'verified' AND e.duplicate_of IS NULL AND s.is_vendor_content = 0;

-- Independent voices per cluster: one author counts once, however often they post.
CREATE VIEW IF NOT EXISTS v_cluster_strength AS
SELECT c.slug, c.segment,
  COUNT(DISTINCT COALESCE(u.author_key, 'src:' || u.source_id))                     AS independent_voices,
  COUNT(DISTINCT u.domain)                                                          AS distinct_domains,
  COUNT(DISTINCT CASE WHEN u.signal_type IN ('behaviour','workaround') THEN COALESCE(u.author_key,'src:'||u.source_id) END) AS behaviour_voices,
  COUNT(DISTINCT CASE WHEN u.signal_type IN ('existing_spend','churn') THEN COALESCE(u.author_key,'src:'||u.source_id) END)  AS spend_voices,
  COUNT(DISTINCT CASE WHEN u.signal_type = 'stated_wtp' THEN COALESCE(u.author_key,'src:'||u.source_id) END)               AS stated_wtp_voices,
  SUM(CASE WHEN ce.stance = 'against' THEN 1 ELSE 0 END)                            AS against_items
FROM clusters c
LEFT JOIN cluster_evidence ce ON ce.cluster_id = c.id
LEFT JOIN v_usable_evidence u ON u.id = ce.evidence_id
GROUP BY c.id;
