#!/usr/bin/env python3
"""Research evidence store CLI. Standard library only; every command is safe to rerun.

  python3 research/rdb.py init                  create/upgrade research.db from schema.sql
  python3 research/rdb.py probe                 test live access to each source, record results
  python3 research/rdb.py ingest FILE.jsonl...  load researcher output (idempotent)
  python3 research/rdb.py fetch [--segment S] [--limit N]   retrieve lead pages, save snapshots
  python3 research/rdb.py verify                check quotes against snapshots, mark duplicates
  python3 research/rdb.py stats                 counts per segment / cluster
  python3 research/rdb.py catalog               regenerate the access table in SOURCE_CATALOG.md
"""
import argparse, gzip, hashlib, html, json, re, sqlite3, sys, time, unicodedata
import urllib.error, urllib.parse, urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "research.db"
SNAPSHOTS = ROOT / "snapshots"
USER_AGENT = "evidence-research/0.1 (solo-founder market research; low volume)"
MAX_QUOTE = 300
FETCH_DELAY_S = 2.0

# Representative endpoints per source; probe records what actually works today.
PROBE_TARGETS = [
    ("Reddit JSON", "https://www.reddit.com/r/smallbusiness/top.json?limit=1"),
    ("Reddit (old) JSON", "https://old.reddit.com/r/smallbusiness/top.json?limit=1"),
    ("Arctic Shift Reddit archive", "https://arctic-shift.photon-reddit.com/api/posts/search?subreddit=smallbusiness&limit=1"),
    ("Hacker News Algolia API", "https://hn.algolia.com/api/v1/search?query=invoice&hitsPerPage=1"),
    ("Hacker News site", "https://news.ycombinator.com/"),
    ("G2", "https://www.g2.com/"),
    ("Capterra", "https://www.capterra.com/"),
    ("GetApp", "https://www.getapp.com/"),
    ("Product Hunt", "https://www.producthunt.com/"),
    ("GitHub REST API", "https://api.github.com/search/issues?q=invoice&per_page=1"),
    ("Stack Exchange API", "https://api.stackexchange.com/2.3/info?site=webapps"),
    ("Shopify App Store", "https://apps.shopify.com/"),
    ("Shopify Community", "https://community.shopify.com/"),
    ("WordPress.org plugins", "https://wordpress.org/plugins/"),
    ("QuickBooks Community", "https://quickbooks.intuit.com/learn-support/en-us/"),
    ("AccountingWEB forum", "https://www.accountingweb.co.uk/any-answers"),
    ("Trustpilot", "https://www.trustpilot.com/"),
    ("BiggerPockets forums", "https://www.biggerpockets.com/forums"),
    ("Wayback Machine", "https://web.archive.org/"),
]

TRACKING_PARAMS = re.compile(r"^(utm_.*|ref|ref_src|fbclid|gclid|share_id|context|sort|rdt|_branch_match_id)$")


def now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def connect():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con


def canonical_url(url):
    """Collapse URL variants (www/old/m., tracking params, Reddit slugs) so cross-posts dedupe."""
    p = urllib.parse.urlsplit(url.strip())
    host = re.sub(r"^(www|old|m|np|amp|new)\.", "", (p.hostname or "").lower())
    path = re.sub(r"/+$", "", p.path) or "/"
    if host == "reddit.com":
        m = re.match(r"^/r/[^/]+/comments/([a-z0-9]+)(?:/[^/]*)?(?:/([a-z0-9]+))?", path, re.I)
        if m:
            path = f"/comments/{m.group(1)}" + (f"/{m.group(2)}" if m.group(2) else "")
        path = re.sub(r"\.json$", "", path)
    elif host == "redd.it":
        host, path = "reddit.com", "/comments" + path
    query = urllib.parse.urlencode(sorted(
        (k, v) for k, v in urllib.parse.parse_qsl(p.query) if not TRACKING_PARAMS.match(k)))
    return urllib.parse.urlunsplit(("https", host, path, query, ""))


def normalise_text(text):
    text = unicodedata.normalize("NFKC", html.unescape(text)).lower()
    text = text.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    return " ".join(re.findall(r"[a-z0-9]+", text))


def quote_hash(quote):
    return hashlib.sha256(normalise_text(quote).encode()).hexdigest()[:16]


def http_get(url, timeout=25):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Language": "en"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.read()


def classify_error(exc):
    msg = str(exc)
    if "Tunnel connection failed: 403" in msg or "Tunnel connection failed: 407" in msg:
        return "proxy_denied", msg
    if isinstance(exc, urllib.error.HTTPError):
        return f"http_{exc.code}", msg
    return "error", msg[:200]


# ---------------------------------------------------------------- commands

def cmd_init(_args):
    with connect() as con:
        con.executescript((ROOT / "schema.sql").read_text())
    SNAPSHOTS.mkdir(exist_ok=True)
    print(f"initialised {DB_PATH.relative_to(ROOT.parent)}")


def cmd_probe(_args):
    with connect() as con:
        for name, url in PROBE_TARGETS:
            try:
                status, body = http_get(url, timeout=20)
                outcome, detail = "ok", f"HTTP {status}, {len(body)} bytes"
            except Exception as exc:  # noqa: BLE001 - every failure is recorded, not raised
                outcome, detail = classify_error(exc)
            con.execute("INSERT INTO access_checks (source_name, url, method, outcome, detail, checked_at)"
                        " VALUES (?,?,?,?,?,?)", (name, url, "shell_http", outcome, detail, now()))
            con.commit()
            print(f"{outcome:14} {name}")


def upsert_source(con, rec):
    url = rec["url"]
    canon = canonical_url(url)
    con.execute("""
        INSERT INTO sources (canonical_url, url, domain, source_type, title, published_at,
                             retrieved_at, access_method, is_vendor_content, notes)
        VALUES (?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(canonical_url) DO UPDATE SET
          title = COALESCE(sources.title, excluded.title),
          published_at = COALESCE(sources.published_at, excluded.published_at),
          is_vendor_content = MAX(sources.is_vendor_content, excluded.is_vendor_content),
          notes = COALESCE(excluded.notes, sources.notes)""",
        (canon, url, urllib.parse.urlsplit(canon).hostname, rec.get("source_type", "other"),
         rec.get("title"), rec.get("published_at"), rec.get("retrieved_at"),
         rec.get("access_method", "websearch_only"), int(bool(rec.get("is_vendor_content"))), rec.get("notes")))
    return con.execute("SELECT id FROM sources WHERE canonical_url = ?", (canon,)).fetchone()[0]


def ingest_record(con, rec):
    kind = rec.get("kind")
    if kind == "run":
        con.execute("INSERT OR IGNORE INTO runs (id, phase, segment, agent, notes) VALUES (?,?,?,?,?)",
                    (rec["id"], rec["phase"], rec.get("segment"), rec.get("agent"), rec.get("notes")))
    elif kind == "access_check":
        con.execute("INSERT INTO access_checks (source_name, url, method, outcome, detail, checked_at)"
                    " SELECT ?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM access_checks WHERE source_name = ?"
                    " AND method = ? AND checked_at = ?)",
                    (rec["source_name"], rec["url"], rec["method"], rec["outcome"], rec.get("detail"),
                     rec["checked_at"], rec["source_name"], rec["method"], rec["checked_at"]))
    elif kind == "query":
        con.execute("INSERT OR IGNORE INTO queries (run_id, segment, tool, query, result_count) VALUES (?,?,?,?,?)",
                    (rec.get("run_id"), rec.get("segment"), rec["tool"], rec["query"], rec.get("result_count")))
    elif kind == "lead":
        qid = None
        if rec.get("query"):
            row = con.execute("SELECT id FROM queries WHERE tool = ? AND query = ?",
                              (rec.get("tool", "websearch"), rec["query"])).fetchone()
            qid = row[0] if row else None
        con.execute("INSERT OR IGNORE INTO leads (canonical_url, url, segment, query_id, search_claim) VALUES (?,?,?,?,?)",
                    (canonical_url(rec["url"]), rec["url"], rec.get("segment"), qid, rec.get("search_claim")))
    elif kind == "source":
        upsert_source(con, rec)
    elif kind == "evidence":
        quote = rec["quote"].strip()
        if len(quote) > MAX_QUOTE:
            raise ValueError(f"quote longer than {MAX_QUOTE} chars: {quote[:60]}...")
        sid = upsert_source(con, rec.get("source") or {"url": rec["url"]})
        qh = quote_hash(quote)
        con.execute("""
            INSERT OR IGNORE INTO evidence (source_id, run_id, segment, author_key, quote, quote_hash, problem,
              workaround, frequency_signal, severity_signal, spend_signal, signal_type, competitor,
              confidence, limitations)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (sid, rec.get("run_id"), rec["segment"], rec.get("author_key"), quote, qh, rec["problem"],
             rec.get("workaround"), rec.get("frequency_signal"), rec.get("severity_signal"),
             rec.get("spend_signal"), rec["signal_type"], rec.get("competitor"), rec["confidence"],
             rec.get("limitations")))
        eid = con.execute("SELECT id FROM evidence WHERE source_id = ? AND quote_hash = ?", (sid, qh)).fetchone()[0]
        for slug in rec.get("clusters", []):
            row = con.execute("SELECT id FROM clusters WHERE slug = ?", (slug,)).fetchone()
            if not row:
                raise ValueError(f"unknown cluster '{slug}': ingest the cluster record first")
            con.execute("INSERT OR IGNORE INTO cluster_evidence (cluster_id, evidence_id, stance) VALUES (?,?,?)",
                        (row[0], eid, rec.get("stance", "supports")))
    elif kind == "cluster":
        con.execute("""
            INSERT INTO clusters (slug, segment, title, problem_statement) VALUES (?,?,?,?)
            ON CONFLICT(slug) DO UPDATE SET title = excluded.title,
              problem_statement = COALESCE(excluded.problem_statement, clusters.problem_statement)""",
            (rec["slug"], rec["segment"], rec["title"], rec.get("problem_statement")))
    elif kind == "competitor":
        psid = upsert_source(con, rec["pricing_source"]) if rec.get("pricing_source") else None
        con.execute("""
            INSERT INTO competitors (name, url, segment, pricing_text, pricing_source_id, notes) VALUES (?,?,?,?,?,?)
            ON CONFLICT(name) DO UPDATE SET url = COALESCE(excluded.url, competitors.url),
              pricing_text = COALESCE(excluded.pricing_text, competitors.pricing_text),
              pricing_source_id = COALESCE(excluded.pricing_source_id, competitors.pricing_source_id),
              notes = COALESCE(excluded.notes, competitors.notes)""",
            (rec["name"], rec.get("url"), rec.get("segment"), rec.get("pricing_text"), psid, rec.get("notes")))
    else:
        raise ValueError(f"unknown record kind: {kind!r}")


def cmd_ingest(args):
    order = {"run": 0, "access_check": 0, "query": 1, "cluster": 2, "source": 3, "lead": 4, "competitor": 5, "evidence": 6}
    with connect() as con:
        for path in args.files:
            lines = [l for l in Path(path).read_text().splitlines() if l.strip()]
            recs = sorted((json.loads(l) for l in lines), key=lambda r: order.get(r.get("kind"), 9))
            for rec in recs:
                ingest_record(con, rec)
            print(f"ingested {len(recs)} records from {path}")


def fetch_url_for(canon):
    if urllib.parse.urlsplit(canon).hostname == "reddit.com":
        return canon + ".json?raw_json=1"
    return canon


def cmd_fetch(args):
    SNAPSHOTS.mkdir(exist_ok=True)
    with connect() as con:
        sql = "SELECT * FROM leads WHERE status = 'new'" + (" AND segment = ?" if args.segment else "") + " LIMIT ?"
        params = ([args.segment] if args.segment else []) + [args.limit]
        for lead in con.execute(sql, params).fetchall():
            try:
                status, body = http_get(fetch_url_for(lead["canonical_url"]))
            except Exception as exc:  # noqa: BLE001
                outcome, detail = classify_error(exc)
                con.execute("UPDATE leads SET status = 'unreachable' WHERE id = ?", (lead["id"],))
                print(f"{outcome:14} {lead['canonical_url']}")
                continue
            sha = hashlib.sha256(body).hexdigest()
            snap = SNAPSHOTS / f"{sha}.gz"
            if not snap.exists():
                snap.write_bytes(gzip.compress(body))
            sid = upsert_source(con, {"url": lead["url"], "access_method": "fetch",
                                      "source_type": guess_source_type(lead["canonical_url"])})
            con.execute("UPDATE sources SET retrieved_at = ?, http_status = ?, snapshot_sha256 = ?,"
                        " access_method = 'fetch' WHERE id = ?", (now(), status, sha, sid))
            con.execute("UPDATE leads SET status = 'fetched' WHERE id = ?", (lead["id"],))
            con.commit()
            print(f"fetched        {lead['canonical_url']}")
            time.sleep(FETCH_DELAY_S)


def guess_source_type(canon):
    host = urllib.parse.urlsplit(canon).hostname or ""
    for needle, kind in (("reddit.com", "reddit"), ("ycombinator.com", "hn"), ("github.com", "github"),
                         ("g2.com", "review_site"), ("capterra.com", "review_site"), ("getapp.com", "review_site"),
                         ("trustpilot.com", "review_site"), ("apps.shopify.com", "app_store"),
                         ("wordpress.org", "app_store"), ("canny.io", "feature_board")):
        if needle in host:
            return kind
    return "forum" if re.search(r"community|forum|discuss", host) else "other"


def snapshot_text(sha):
    raw = gzip.decompress((SNAPSHOTS / f"{sha}.gz").read_bytes()).decode("utf-8", "replace")
    try:
        data = json.loads(raw)
        parts = []
        def walk(node):
            if isinstance(node, dict):
                for v in node.values():
                    walk(v)
            elif isinstance(node, list):
                for v in node:
                    walk(v)
            elif isinstance(node, str):
                parts.append(node)
        walk(data)
        return " ".join(parts)
    except ValueError:
        raw = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", raw)
        return re.sub(r"<[^>]+>", " ", raw)


def cmd_verify(_args):
    with connect() as con:
        cache, counts = {}, {"verified": 0, "not_found": 0, "skipped": 0}
        rows = con.execute("""SELECT e.id, e.quote, s.snapshot_sha256 FROM evidence e JOIN sources s ON s.id = e.source_id
                              WHERE e.verification != 'verified'""").fetchall()
        for row in rows:
            sha = row["snapshot_sha256"]
            if not sha or not (SNAPSHOTS / f"{sha}.gz").exists():
                counts["skipped"] += 1
                continue
            if sha not in cache:
                cache[sha] = normalise_text(snapshot_text(sha))
            # A quote may elide text with "..."; every fragment must appear verbatim.
            fragments = [normalise_text(f) for f in re.split(r"\.\.\.|…", row["quote"])]
            ok = all(f in cache[sha] for f in fragments if f)
            state = "verified" if ok else "not_found"
            con.execute("UPDATE evidence SET verification = ?, verified_at = ? WHERE id = ?", (state, now(), row["id"]))
            counts[state] += 1
        # Same quote on several pages (cross-posts, syndication) counts once: keep the earliest row.
        con.execute("""UPDATE evidence SET duplicate_of = (
                         SELECT MIN(e2.id) FROM evidence e2 WHERE e2.quote_hash = evidence.quote_hash)
                       WHERE id != (SELECT MIN(e2.id) FROM evidence e2 WHERE e2.quote_hash = evidence.quote_hash)""")
        dups = con.execute("SELECT COUNT(*) FROM evidence WHERE duplicate_of IS NOT NULL").fetchone()[0]
        print(f"verified {counts['verified']}, not found {counts['not_found']}, "
              f"no snapshot {counts['skipped']}, duplicates {dups}")


def cmd_stats(_args):
    with connect() as con:
        print("evidence by segment / verification:")
        for r in con.execute("SELECT segment, verification, COUNT(*) n FROM evidence GROUP BY 1,2 ORDER BY 1,2"):
            print(f"  {r['segment']:28} {r['verification']:11} {r['n']}")
        print("leads:", dict(con.execute("SELECT status, COUNT(*) FROM leads GROUP BY 1").fetchall()))
        print("queries run:", con.execute("SELECT COUNT(*) FROM queries").fetchone()[0])
        print("cluster strength (verified, non-duplicate, non-vendor only):")
        for r in con.execute("SELECT * FROM v_cluster_strength ORDER BY independent_voices DESC"):
            print("  " + ", ".join(f"{k}={r[k]}" for k in r.keys()))


def cmd_catalog(_args):
    path = ROOT / "SOURCE_CATALOG.md"
    start, end = "<!-- access-table:start -->", "<!-- access-table:end -->"
    with connect() as con:
        rows = con.execute("""SELECT source_name, url, outcome, detail, checked_at FROM access_checks a
                              WHERE id = (SELECT MAX(id) FROM access_checks b WHERE b.source_name = a.source_name)
                              ORDER BY source_name""").fetchall()
    table = ["| Source | Probe URL | Latest result | Checked (UTC) |", "|---|---|---|---|"]
    table += [f"| {r['source_name']} | `{r['url']}` | {r['outcome']} | {r['checked_at']} |" for r in rows]
    text = path.read_text()
    text = re.sub(re.escape(start) + r".*?" + re.escape(end), start + "\n" + "\n".join(table) + "\n" + end,
                  text, flags=re.S)
    path.write_text(text)
    print(f"updated {path.name} with {len(rows)} sources")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("init", "probe", "verify", "stats", "catalog"):
        sub.add_parser(name)
    p = sub.add_parser("ingest"); p.add_argument("files", nargs="+")
    p = sub.add_parser("fetch"); p.add_argument("--segment"); p.add_argument("--limit", type=int, default=20)
    args = ap.parse_args()
    {"init": cmd_init, "probe": cmd_probe, "ingest": cmd_ingest, "fetch": cmd_fetch,
     "verify": cmd_verify, "stats": cmd_stats, "catalog": cmd_catalog}[args.cmd](args)


if __name__ == "__main__":
    sys.exit(main())
