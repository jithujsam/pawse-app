#!/usr/bin/env python3
"""Evidence store CLI for the email-centric sales platform research. Standard library only.

findings/*.jsonl is the source of truth; research.db is rebuilt from it and never edited by hand.

  python3 research/rdb.py build              recreate research.db from schema.sql + findings/*.jsonl, then verify
  python3 research/rdb.py snap URL           fetch one page, save snapshot, print a ready `source` record
  python3 research/rdb.py text SHA [GREP]    print a snapshot as readable text (optionally only lines matching GREP)
  python3 research/rdb.py check FILE.jsonl   dry-run: ingest + verify one file into a temp DB, list failing quotes
  python3 research/rdb.py stats              coverage and verification counts
  python3 research/rdb.py render             regenerate reports/generated/*.md from the database
"""
import argparse, gzip, hashlib, html, json, re, sqlite3, sys, tempfile, time, unicodedata
import urllib.error, urllib.parse, urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "research.db"
SNAPSHOTS = ROOT / "snapshots"
FINDINGS = ROOT / "findings"
GENERATED = ROOT / "reports" / "generated"
USER_AGENT = "Mozilla/5.0 (compatible; delecta-research/0.2; low-volume market research)"
MAX_QUOTE = 300
MAX_EXCERPT = 600
FETCH_DELAY_S = 2.0
ARCTIC = "https://arctic-shift.photon-reddit.com/api"

TRACKING_PARAMS = re.compile(r"^(utm_.*|ref|ref_src|fbclid|gclid|share_id|context|sort|rdt|_branch_match_id|hl)$")


def now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def connect(path=DB_PATH):
    con = sqlite3.connect(path)
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
    text = text.replace("\u2019", "'").replace("\u2018", "'").replace("\u201c", '"').replace("\u201d", '"')
    return " ".join(re.findall(r"[a-z0-9]+", text))


def text_hash(text):
    return hashlib.sha256(normalise_text(text).encode()).hexdigest()[:16]


def http_get(url, timeout=40):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Language": "en"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.read()


# ---------------------------------------------------------------- retrieval

def api_json(url, tries=4):
    """GET JSON, backing off when an API asks us to slow down (Arctic Shift returns a 'Timeout' error body)."""
    for attempt in range(tries):
        status, body = http_get(url, timeout=90)
        data = json.loads(body)
        if not (isinstance(data, dict) and data.get("error")):
            return status, data
        time.sleep(4 * (attempt + 1))
    raise RuntimeError(f"API kept refusing: {data.get('error')}")


def retrieve(canon, url=None):
    """Return (status, bytes, route). Reddit is read through the Arctic Shift archive because reddit.com
    redirects unauthenticated requests to a login page; HN items through the Algolia API."""
    p = urllib.parse.urlsplit(canon)
    if p.hostname == "reddit.com":
        m = re.match(r"^/comments/([a-z0-9]+)", p.path)
        if not m:
            raise ValueError("only Reddit thread URLs can be snapshotted")
        _, post = api_json(f"{ARCTIC}/posts/ids?ids={m.group(1)}")
        time.sleep(FETCH_DELAY_S)
        status, tree = api_json(f"{ARCTIC}/comments/tree?link_id=t3_{m.group(1)}&limit=500")
        return status, json.dumps({"post": post.get("data"), "comments": tree.get("data")}).encode(), "arctic_shift"
    if p.hostname == "news.ycombinator.com" and p.path == "/item":
        item = dict(urllib.parse.parse_qsl(p.query))["id"]
        status, body = http_get(f"https://hn.algolia.com/api/v1/items/{item}")
        return status, body, "hn_algolia"
    status, body = http_get(url or canon)
    return status, body, "direct"


def guess_source_type(canon):
    host = urllib.parse.urlsplit(canon).hostname or ""
    for needle, kind in (("reddit.com", "reddit"), ("ycombinator.com", "hn"), ("g2.com", "review_site"),
                         ("capterra.com", "review_site"), ("getapp.com", "review_site"), ("trustradius.com", "review_site"),
                         ("softwareadvice.com", "review_site"), ("workspace.google.com/marketplace", "marketplace"),
                         ("appsource.microsoft.com", "marketplace"), ("chromewebstore.google.com", "marketplace"),
                         ("developers.google.com", "official_doc"), ("support.google.com", "official_doc"),
                         ("learn.microsoft.com", "official_doc"), ("cloud.google.com", "official_doc")):
        if needle in host + urllib.parse.urlsplit(canon).path:
            return kind
    return "forum" if re.search(r"community|forum|discuss", host) else "other"


def snapshot_raw(sha):
    return gzip.decompress((SNAPSHOTS / f"{sha}.gz").read_bytes()).decode("utf-8", "replace")


def snapshot_text(sha):
    """All text in a snapshot, including review text embedded as JSON inside <script> (Capterra, GetApp)."""
    raw = snapshot_raw(sha)
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
        scripts = " ".join(re.findall(r"(?is)<script[^>]*>(.*?)</script>", raw))
        visible = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", raw)
        visible = re.sub(r"<[^>]+>", " ", visible)
        scripts = re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), scripts)
        return visible + " " + re.sub(r"\\+[nrt\"]?", " ", scripts)


def readable_text(sha):
    raw = snapshot_raw(sha)
    try:
        data = json.loads(raw)
    except ValueError:
        visible = re.sub(r"(?is)<(script|style|nav|footer)[^>]*>.*?</\1>", " ", raw)
        visible = re.sub(r"(?i)<(br|/p|/div|/li|/h[1-6]|/tr)[^>]*>", "\n", visible)
        visible = html.unescape(re.sub(r"<[^>]+>", " ", visible))
        lines = (re.sub(r"[ \t]+", " ", l).strip() for l in visible.splitlines())
        return "\n".join(l for l in lines if l)
    lines = []
    def walk(node, depth=0):
        if isinstance(node, list):
            for v in node:
                walk(v, depth)
        elif isinstance(node, dict):
            d = node.get("data") if node.get("kind") in ("t1", "t3") else node
            text = d.get("selftext") or d.get("body") or d.get("text") or d.get("comment_text")
            title = d.get("title")
            if title or text:
                when = d.get("created_utc") or d.get("created_at") or ""
                if isinstance(when, (int, float)):
                    when = datetime.fromtimestamp(when, timezone.utc).strftime("%Y-%m-%d")
                lines.append(f"{'  ' * depth}[{d.get('author')} {when}] {title or ''} {html.unescape(text or '')}".strip())
            for key in ("replies", "children", "comments", "post", "data"):
                v = d.get(key) if isinstance(d, dict) else None
                if isinstance(v, (list, dict)) and v is not node:
                    walk(v, depth + 1)
    walk(data)
    return "\n".join(lines)


# ---------------------------------------------------------------- ingest

def upsert_source(con, rec):
    url = rec["url"]
    canon = canonical_url(url)
    con.execute("""
        INSERT INTO sources (canonical_url, url, domain, source_type, title, published_at,
                             retrieved_at, access_method, is_vendor_content, notes, http_status, snapshot_sha256)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(canonical_url) DO UPDATE SET
          title = COALESCE(sources.title, excluded.title),
          source_type = CASE WHEN sources.source_type = 'other' THEN excluded.source_type ELSE sources.source_type END,
          retrieved_at = COALESCE(excluded.retrieved_at, sources.retrieved_at),
          access_method = CASE WHEN excluded.snapshot_sha256 IS NOT NULL THEN excluded.access_method
                               ELSE sources.access_method END,
          http_status = COALESCE(excluded.http_status, sources.http_status),
          snapshot_sha256 = COALESCE(excluded.snapshot_sha256, sources.snapshot_sha256),
          published_at = COALESCE(sources.published_at, excluded.published_at),
          is_vendor_content = MAX(sources.is_vendor_content, excluded.is_vendor_content),
          notes = COALESCE(excluded.notes, sources.notes)""",
        (canon, url, urllib.parse.urlsplit(canon).hostname, rec.get("source_type") or guess_source_type(canon),
         rec.get("title"), rec.get("published_at"), rec.get("retrieved_at"),
         rec.get("access_method", "websearch_only"), int(bool(rec.get("is_vendor_content"))), rec.get("notes"),
         rec.get("http_status"), rec.get("snapshot_sha256")))
    return con.execute("SELECT id FROM sources WHERE canonical_url = ?", (canon,)).fetchone()[0]


def source_for(con, rec):
    return upsert_source(con, rec.get("source") or {"url": rec["url"]})


def upsert(con, table, key_cols, row):
    cols = list(row)
    updates = ", ".join(f"{c} = excluded.{c}" for c in cols if c not in key_cols)
    con.execute(f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})"
                f" ON CONFLICT({', '.join(key_cols)}) DO UPDATE SET {updates}", [row[c] for c in cols])


def ingest_record(con, rec):
    kind = rec.get("kind")
    if kind == "run":
        con.execute("INSERT OR IGNORE INTO runs (id, phase, workstream, agent, notes) VALUES (?,?,?,?,?)",
                    (rec["id"], rec["phase"], rec.get("workstream"), rec.get("agent"), rec.get("notes")))
    elif kind == "query":
        con.execute("INSERT OR IGNORE INTO queries (run_id, tool, query, result_count) VALUES (?,?,?,?)",
                    (rec.get("run_id"), rec["tool"], rec["query"], rec.get("result_count")))
    elif kind == "source":
        upsert_source(con, rec)
    elif kind == "evidence":
        quote = rec["quote"].strip()
        if len(quote) > MAX_QUOTE:
            raise ValueError(f"quote longer than {MAX_QUOTE} chars: {quote[:60]}...")
        sid = source_for(con, rec)
        qh = text_hash(quote)
        con.execute("""
            INSERT OR IGNORE INTO evidence (source_id, run_id, segment, workflow_area, author_key, quote, quote_hash,
              problem, workaround, tools_mentioned, frequency_signal, severity_signal, spend_signal, first_hand,
              signal_type, competitor, confidence, limitations)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (sid, rec.get("run_id"), rec["segment"], rec["workflow_area"], rec.get("author_key"), quote, qh,
             rec["problem"], rec.get("workaround"), rec.get("tools_mentioned"), rec.get("frequency_signal"),
             rec.get("severity_signal"), rec.get("spend_signal"), int(rec.get("first_hand", True)),
             rec["signal_type"], rec.get("competitor"), rec["confidence"], rec.get("limitations")))
        eid = con.execute("SELECT id FROM evidence WHERE source_id = ? AND quote_hash = ?", (sid, qh)).fetchone()[0]
        for slug in rec.get("clusters", []):
            row = con.execute("SELECT id FROM clusters WHERE slug = ?", (slug,)).fetchone()
            if not row:
                raise ValueError(f"unknown cluster '{slug}': ingest the cluster record first")
            con.execute("INSERT OR IGNORE INTO cluster_evidence (cluster_id, evidence_id, stance) VALUES (?,?,?)",
                        (row[0], eid, rec.get("stance", "supports")))
    elif kind == "fact":
        excerpt = rec["excerpt"].strip()
        if len(excerpt) > MAX_EXCERPT:
            raise ValueError(f"excerpt longer than {MAX_EXCERPT} chars: {excerpt[:60]}...")
        sid = source_for(con, rec)
        con.execute("""INSERT OR IGNORE INTO facts (source_id, run_id, subject, topic, claim, excerpt, excerpt_hash, value, as_of)
                       VALUES (?,?,?,?,?,?,?,?,?)""",
                    (sid, rec.get("run_id"), rec["subject"].lower(), rec["topic"], rec["claim"], excerpt,
                     text_hash(excerpt), rec.get("value"), rec.get("as_of")))
    elif kind == "capability":
        upsert(con, "capabilities", ["product", "capability"],
               {k: rec.get(k) for k in ("product", "capability", "value", "detail", "fact_ids")})
    elif kind == "cluster":
        con.execute("""
            INSERT INTO clusters (slug, workflow_area, title, problem_statement, status, rejection_reason)
            VALUES (?,?,?,?,COALESCE(?,'open'),?)
            ON CONFLICT(slug) DO UPDATE SET title = excluded.title, workflow_area = excluded.workflow_area,
              problem_statement = COALESCE(excluded.problem_statement, clusters.problem_statement),
              status = excluded.status, rejection_reason = COALESCE(excluded.rejection_reason, clusters.rejection_reason)""",
            (rec["slug"], rec.get("workflow_area"), rec["title"], rec.get("problem_statement"), rec.get("status"),
             rec.get("rejection_reason")))
    elif kind == "link":  # attach existing evidence (by url + quote) to a cluster after the fact
        sid = source_for(con, rec)
        row = con.execute("SELECT id FROM evidence WHERE source_id = ? AND quote_hash = ?",
                          (sid, text_hash(rec["quote"]))).fetchone()
        cl = con.execute("SELECT id FROM clusters WHERE slug = ?", (rec["cluster"],)).fetchone()
        if not row or not cl:
            raise ValueError(f"link target missing: {rec['cluster']} / {rec['quote'][:50]}")
        con.execute("INSERT OR IGNORE INTO cluster_evidence (cluster_id, evidence_id, stance) VALUES (?,?,?)",
                    (cl[0], row[0], rec.get("stance", "supports")))
    elif kind == "hypothesis":
        upsert(con, "hypotheses", ["slug"],
               {k: rec.get(k) for k in ("slug", "title", "statement", "rejection_reason")}
               | {"kind": rec["htype"], "status": rec.get("status", "open")})
    elif kind == "score":
        upsert(con, "scores", ["hypothesis", "criterion"],
               {k: rec.get(k) for k in ("hypothesis", "criterion", "score", "basis", "rationale", "refs")})
    elif kind == "risk":
        upsert(con, "risks", ["slug"], {k: rec.get(k) for k in ("slug", "area", "risk", "likelihood", "impact", "refs",
                                                                 "mitigation")}
               | {"needs_provider_clarification": int(bool(rec.get("needs_provider_clarification")))})
    elif kind == "unknown":
        upsert(con, "unknowns", ["slug"], {k: rec.get(k) for k in ("slug", "question", "why_it_matters", "gate",
                                                                    "resolve_by")} | {"status": rec.get("status", "open")})
    elif kind == "experiment":
        upsert(con, "experiments", ["slug"], {k: rec.get(k) for k in (
            "slug", "rank", "hypothesis", "participants", "recruitment", "procedure", "cost", "duration", "success",
            "failure", "confounders", "decisions", "result")} | {"status": rec.get("status", "designed")})
    elif kind == "gate":
        upsert(con, "gates", ["id"], {k: rec.get(k) for k in ("id", "name", "pass_criterion", "status", "rationale",
                                                               "refs")})
    else:
        raise ValueError(f"unknown record kind: {kind!r}")


ORDER = {"run": 0, "query": 1, "cluster": 2, "hypothesis": 2, "source": 3, "fact": 4, "evidence": 5, "link": 6,
         "capability": 6, "score": 7, "risk": 7, "unknown": 7, "experiment": 7, "gate": 8}


def ingest_files(con, paths):
    recs = []
    for path in paths:
        for n, line in enumerate(Path(path).read_text().splitlines(), 1):
            if line.strip():
                try:
                    recs.append((Path(path).name, n, json.loads(line)))
                except json.JSONDecodeError as exc:
                    raise SystemExit(f"{path}:{n}: bad JSON: {exc}")
    for name, n, rec in sorted(recs, key=lambda r: ORDER.get(r[2].get("kind"), 9)):
        try:
            ingest_record(con, rec)
        except (KeyError, ValueError, sqlite3.IntegrityError) as exc:
            raise SystemExit(f"{name}:{n}: {type(exc).__name__}: {exc}")
    return len(recs)


def verify(con):
    """Mark each quote/excerpt verified only if every '...'-separated fragment appears in the page snapshot."""
    cache, counts = {}, {"verified": 0, "not_found": 0, "no_snapshot": 0}
    def check(text, sha):
        if not sha or not (SNAPSHOTS / f"{sha}.gz").exists():
            return None
        if sha not in cache:
            cache[sha] = normalise_text(snapshot_text(sha))
        fragments = [normalise_text(f) for f in re.split(r"\.\.\.|\u2026|\[\.\.\.\]", text)]
        return all(f in cache[sha] for f in fragments if f)
    for table, col in (("evidence", "quote"), ("facts", "excerpt")):
        rows = con.execute(f"SELECT t.id, t.{col} AS txt, s.snapshot_sha256 AS sha FROM {table} t "
                           f"JOIN sources s ON s.id = t.source_id").fetchall()
        for row in rows:
            ok = check(row["txt"], row["sha"])
            state = "unverified" if ok is None else ("verified" if ok else "not_found")
            counts["no_snapshot" if ok is None else state] += 1
            con.execute(f"UPDATE {table} SET verification = ?, verified_at = ? WHERE id = ?",
                        (state, None if ok is None else now(), row["id"]))
    # Same quote on several pages (cross-posts, syndication) counts once: keep the earliest row.
    con.execute("""UPDATE evidence SET duplicate_of = (SELECT MIN(e2.id) FROM evidence e2 WHERE e2.quote_hash = evidence.quote_hash)
                   WHERE id != (SELECT MIN(e2.id) FROM evidence e2 WHERE e2.quote_hash = evidence.quote_hash)""")
    return counts


# ---------------------------------------------------------------- commands

def cmd_build(_args):
    if DB_PATH.exists():
        DB_PATH.unlink()
    files = sorted(FINDINGS.glob("*.jsonl"))
    with connect() as con:
        con.executescript((ROOT / "schema.sql").read_text())
        n = ingest_files(con, files)
        counts = verify(con)
    print(f"built research.db from {len(files)} files, {n} records; quotes/excerpts: {counts}")


def cmd_check(args):
    with tempfile.TemporaryDirectory() as tmp:
        con = connect(Path(tmp) / "check.db")
        con.executescript((ROOT / "schema.sql").read_text())
        files = [p for p in sorted(FINDINGS.glob("*.jsonl")) if p.resolve() != Path(args.file).resolve()]
        ingest_files(con, files + [Path(args.file)])  # other files first so cross-file cluster refs resolve
        counts = verify(con)
        print(counts)
        for table, col in (("evidence", "quote"), ("facts", "excerpt")):
            for r in con.execute(f"SELECT t.{col} AS txt, s.url, t.verification FROM {table} t JOIN sources s"
                                 f" ON s.id = t.source_id WHERE t.verification != 'verified'"):
                print(f"  {r['verification']:10} {table}: {r['url']}\n             {r['txt'][:140]!r}")


def cmd_snap(args):
    SNAPSHOTS.mkdir(exist_ok=True)
    canon = canonical_url(args.url)
    status, body, route = retrieve(canon, args.url)
    sha = hashlib.sha256(body).hexdigest()
    snap = SNAPSHOTS / f"{sha}.gz"
    if not snap.exists():
        snap.write_bytes(gzip.compress(body))
    rec = {"kind": "source", "url": args.url, "source_type": guess_source_type(canon), "retrieved_at": now(),
           "access_method": "fetch", "http_status": status, "snapshot_sha256": sha, "notes": f"route={route}"}
    print(json.dumps(rec))
    print(f"# {len(body)} bytes; read with: python3 research/rdb.py text {sha}", file=sys.stderr)


def cmd_text(args):
    text = readable_text(args.sha)
    if args.grep:
        pat = re.compile(args.grep, re.I)
        text = "\n".join(l for l in text.splitlines() if pat.search(l))
    print(text)


def cmd_stats(_args):
    with connect() as con:
        q = lambda sql: con.execute(sql).fetchall()
        print("sources by type:", {r[0]: r[1] for r in q("SELECT source_type, COUNT(*) FROM sources GROUP BY 1")})
        print("facts by subject/verification:")
        for r in q("SELECT subject, verification, COUNT(*) FROM facts GROUP BY 1,2 ORDER BY 1,2"):
            print(f"  {r[0]:22} {r[1]:11} {r[2]}")
        print("evidence by workflow area/verification:")
        for r in q("SELECT workflow_area, verification, COUNT(*) FROM evidence GROUP BY 1,2 ORDER BY 1,2"):
            print(f"  {r[0]:4} {r[1]:11} {r[2]}")
        print("evidence by segment (usable):", {r[0]: r[1] for r in q("SELECT segment, COUNT(*) FROM v_usable_evidence GROUP BY 1")})
        print("queries run:", q("SELECT COUNT(*) FROM queries")[0][0])
        print("cluster strength:")
        for r in q("SELECT * FROM v_cluster_strength ORDER BY independent_voices DESC"):
            print("  " + ", ".join(f"{k}={r[k]}" for k in r.keys()))


def md_escape(text):
    return (text or "").replace("|", "\\|").replace("\n", " ")


def write_generated(name, title, lines):
    GENERATED.mkdir(parents=True, exist_ok=True)
    header = [f"# {title}", "", "_Generated by `python3 research/rdb.py render` from research.db. Do not edit by hand._", ""]
    (GENERATED / name).write_text("\n".join(header + lines) + "\n")


def cmd_render(_args):
    with connect() as con:
        q = lambda sql, *a: con.execute(sql, a).fetchall()

        # Source catalog
        lines = ["| ID | Type | Title | URL | Published | Retrieved | Snapshot |", "|---|---|---|---|---|---|---|"]
        for r in q("SELECT * FROM sources ORDER BY source_type, domain, id"):
            lines.append(f"| S{r['id']} | {r['source_type']} | {md_escape(r['title'])[:80]} | {r['url']} | "
                         f"{r['published_at'] or ''} | {(r['retrieved_at'] or 'search only')[:10]} | "
                         f"{(r['snapshot_sha256'] or '')[:12]} |")
        write_generated("SOURCE_CATALOG.md", "Source catalog", lines)

        # Facts (provider requirements, competitor capabilities, pricing)
        lines = []
        for subject in [r[0] for r in q("SELECT DISTINCT subject FROM facts ORDER BY 1")]:
            lines += [f"## {subject}", "", "| ID | Topic | Claim (analyst reading) | Verbatim excerpt | Value | Status | Source |",
                      "|---|---|---|---|---|---|---|"]
            for r in q("SELECT f.*, s.url FROM facts f JOIN sources s ON s.id = f.source_id WHERE subject = ? "
                       "ORDER BY topic, f.id", subject):
                lines.append(f"| F{r['id']} | {r['topic']} | {md_escape(r['claim'])} | \"{md_escape(r['excerpt'])}\" | "
                             f"{md_escape(r['value'])} | {r['verification']} | {r['url']} |")
            lines.append("")
        write_generated("FACTS.md", "Facts from official and vendor documentation", lines)

        # Capability matrix
        caps = [r[0] for r in q("SELECT DISTINCT capability FROM capabilities ORDER BY 1")]
        prods = [r[0] for r in q("SELECT DISTINCT product FROM capabilities ORDER BY 1")]
        cell = {(r["product"], r["capability"]): r for r in q("SELECT * FROM capabilities")}
        sym = {"yes": "Y", "partial": "P", "no": "N", "unknown": "?", "n/a": "-"}
        lines = ["Legend: Y yes, P partial, N no, ? not verified, - not applicable. Each cell cites fact ids (see FACTS.md).", "",
                 "| Product | " + " | ".join(caps) + " |", "|---|" + "---|" * len(caps)]
        for p in prods:
            row = []
            for c in caps:
                r = cell.get((p, c))
                row.append(f"{sym[r['value']]}{' ' + r['fact_ids'] if r and r['fact_ids'] else ''}" if r else "")
            lines.append(f"| {p} | " + " | ".join(row) + " |")
        lines += ["", "## Cell details", ""]
        for r in q("SELECT * FROM capabilities WHERE detail IS NOT NULL ORDER BY product, capability"):
            lines.append(f"- **{r['product']} / {r['capability']}** ({r['value']}): {r['detail']} [{r['fact_ids'] or 'no fact'}]")
        write_generated("CAPABILITY_MATRIX.md", "Competitor capability matrix", lines)

        # Pricing
        lines = ["| ID | Product | Price / plan (claim) | Verbatim excerpt | Status | As of | Source |", "|---|---|---|---|---|---|---|"]
        for r in q("SELECT f.*, s.url FROM facts f JOIN sources s ON s.id = f.source_id WHERE topic LIKE 'pricing%' "
                   "ORDER BY subject, f.id"):
            lines.append(f"| F{r['id']} | {r['subject']} | {md_escape(r['claim'])} | \"{md_escape(r['excerpt'])}\" | "
                         f"{r['verification']} | {r['as_of'] or ''} | {r['url']} |")
        write_generated("PRICING.md", "Pricing comparison (verified excerpts)", lines)

        # Customer evidence grouped by workflow area
        lines = []
        for area in [r[0] for r in q("SELECT DISTINCT workflow_area FROM evidence ORDER BY 1")]:
            lines += [f"## Workflow area {area}", "",
                      "| ID | Segment | Quote | Problem | Workaround | Signal | 1st-hand | Conf. | Status | Source |",
                      "|---|---|---|---|---|---|---|---|---|---|"]
            for r in q("SELECT e.*, s.url, s.published_at FROM evidence e JOIN sources s ON s.id = e.source_id "
                       "WHERE workflow_area = ? ORDER BY e.id", area):
                status = r["verification"] + (f", dup of E{r['duplicate_of']}" if r["duplicate_of"] else "")
                lines.append(f"| E{r['id']} | {r['segment']} | \"{md_escape(r['quote'])}\" | {md_escape(r['problem'])} | "
                             f"{md_escape(r['workaround'])} | {r['signal_type']} | {'Y' if r['first_hand'] else 'N'} | "
                             f"{r['confidence']} | {status} | {r['url']} ({r['published_at'] or 'n.d.'}) |")
            lines.append("")
        write_generated("CUSTOMER_EVIDENCE.md", "Customer evidence by workflow area", lines)

        # Clusters
        lines = ["| Cluster | Area | Status | Voices | Domains | 1st-hand | Money signals | Against | Problem |",
                 "|---|---|---|---|---|---|---|---|---|"]
        for r in q("SELECT v.*, c.problem_statement, c.rejection_reason FROM v_cluster_strength v JOIN clusters c "
                   "ON c.slug = v.slug ORDER BY independent_voices DESC"):
            lines.append(f"| {r['slug']} | {r['workflow_area'] or ''} | {r['status']} | {r['independent_voices']} | "
                         f"{r['distinct_domains']} | {r['first_hand_voices']} | {r['money_voices']} | {r['against_voices']} | "
                         f"{md_escape(r['problem_statement'])}{' — rejected: ' + md_escape(r['rejection_reason']) if r['rejection_reason'] else ''} |")
        lines += ["", "## Evidence per cluster", ""]
        for c in q("SELECT * FROM clusters ORDER BY slug"):
            lines.append(f"### {c['slug']}: {c['title']}")
            for r in q("SELECT ce.stance, u.id, u.quote, u.canonical_url FROM cluster_evidence ce JOIN v_usable_evidence u "
                       "ON u.id = ce.evidence_id WHERE ce.cluster_id = ? ORDER BY ce.stance DESC, u.id", c["id"]):
                lines.append(f"- [{r['stance']}] E{r['id']}: \"{r['quote']}\" ({r['canonical_url']})")
            lines.append("")
        write_generated("CLUSTERS.md", "Pain-point clusters (verified, non-duplicate evidence only)", lines)

        # Hypotheses and scores
        lines = []
        for kind in ("segment", "wedge", "architecture", "pricing"):
            hyps = q("SELECT * FROM hypotheses WHERE kind = ? ORDER BY slug", kind)
            if not hyps:
                continue
            crits = [r[0] for r in q("SELECT DISTINCT s.criterion FROM scores s JOIN hypotheses h ON h.slug = s.hypothesis "
                                     "WHERE h.kind = ? ORDER BY 1", kind)]
            lines += [f"## {kind.title()} hypotheses", "",
                      "| Hypothesis | Status | " + " | ".join(crits) + " | Total | Unknown-basis |",
                      "|---|---|" + "---|" * (len(crits) + 2)]
            for h in hyps:
                sc = {r["criterion"]: r for r in q("SELECT * FROM scores WHERE hypothesis = ?", h["slug"])}
                total = sum(r["score"] for r in sc.values())
                unk = sum(1 for r in sc.values() if r["basis"] == "unknown")
                lines.append(f"| {h['slug']} | {h['status']} | " +
                             " | ".join(f"{sc[c]['score']}{'*' if sc[c]['basis'] != 'fact' else ''}" if c in sc else ""
                                        for c in crits) + f" | {total} | {unk} |")
            lines += ["", "`*` = score rests on inference or is unknown, not on a recorded fact.", ""]
            for h in hyps:
                lines.append(f"### {h['slug']}: {h['title']}")
                if h["statement"]:
                    lines.append(h["statement"])
                if h["rejection_reason"]:
                    lines.append(f"**Rejected:** {h['rejection_reason']}")
                for r in q("SELECT * FROM scores WHERE hypothesis = ? ORDER BY criterion", h["slug"]):
                    lines.append(f"- {r['criterion']}: {r['score']} ({r['basis']}) {r['rationale']} [{r['refs'] or ''}]")
                lines.append("")
        write_generated("HYPOTHESES.md", "Hypotheses and scores", lines)

        # Risks, unknowns, experiments, gates
        lines = ["| Risk | Area | Likelihood | Impact | Needs provider clarification | Refs | Mitigation |",
                 "|---|---|---|---|---|---|---|"]
        for r in q("SELECT * FROM risks ORDER BY CASE impact WHEN 'launch_blocking' THEN 0 WHEN 'high' THEN 1 "
                   "WHEN 'medium' THEN 2 ELSE 3 END, area"):
            lines.append(f"| **{r['slug']}**: {md_escape(r['risk'])} | {r['area']} | {r['likelihood']} | {r['impact']} | "
                         f"{'yes' if r['needs_provider_clarification'] else ''} | {r['refs'] or ''} | {md_escape(r['mitigation'])} |")
        write_generated("RISK_REGISTER.md", "Provider policy, compliance and technical risk register", lines)

        lines = ["| Unknown | Why it matters | Gate | Resolve by | Status |", "|---|---|---|---|---|"]
        for r in q("SELECT * FROM unknowns ORDER BY gate, slug"):
            lines.append(f"| **{r['slug']}**: {md_escape(r['question'])} | {md_escape(r['why_it_matters'])} | "
                         f"{r['gate'] or ''} | {md_escape(r['resolve_by'])} | {r['status']} |")
        write_generated("UNKNOWNS.md", "Unresolved questions that affect the decision", lines)

        lines = ["| Gate | Pass criterion | Status | Rationale | Refs |", "|---|---|---|---|---|"]
        for r in q("SELECT * FROM gates ORDER BY id"):
            lines.append(f"| {r['id']}. {r['name']} | {md_escape(r['pass_criterion'])} | **{r['status']}** | "
                         f"{md_escape(r['rationale'])} | {r['refs'] or ''} |")
        write_generated("GATES.md", "Go/no-go scorecard", lines)
    print(f"rendered {len(list(GENERATED.glob('*.md')))} files into {GENERATED.relative_to(ROOT.parent)}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("build", "stats", "render"):
        sub.add_parser(name)
    sub.add_parser("snap").add_argument("url")
    sub.add_parser("check").add_argument("file")
    p = sub.add_parser("text"); p.add_argument("sha"); p.add_argument("grep", nargs="?")
    args = ap.parse_args()
    {"build": cmd_build, "stats": cmd_stats, "render": cmd_render, "snap": cmd_snap, "check": cmd_check,
     "text": cmd_text}[args.cmd](args)


if __name__ == "__main__":
    sys.exit(main())
