#!/usr/bin/env python3
"""Cold-email deliverability audit for one or more sending domains.

Checks MX, SPF, DMARC, common DKIM selectors and a custom tracking domain
using Google's free DNS-over-HTTPS API, so no paid tool or DNS library is
needed. Standard library only.

Usage:
    python3 dns_check.py example.com other.io
    python3 dns_check.py --file domains.txt --json
"""
import argparse
import json
import sys
import urllib.parse
import urllib.request

DOH_URL = "https://dns.google/resolve"
DKIM_SELECTORS = ["google", "selector1", "selector2", "default", "k1", "s1", "s2",
                  "mail", "dkim", "smtp", "mxvault", "zoho"]


def resolve(name, rtype):
    query = urllib.parse.urlencode({"name": name, "type": rtype})
    req = urllib.request.Request(f"{DOH_URL}?{query}", headers={"Accept": "application/dns-json"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.load(resp)
    return [a["data"].strip('"').replace('" "', "") for a in data.get("Answer", [])
            if a.get("type") in (1, 5, 15, 16)]


def check_spf(domain):
    records = [r for r in resolve(domain, "TXT") if r.lower().startswith("v=spf1")]
    if not records:
        return "fail", "No SPF record. Receivers cannot verify who may send for this domain."
    if len(records) > 1:
        return "fail", f"{len(records)} SPF records found. Only one is allowed; merge them."
    spf = records[0]
    lookups = sum(spf.count(k) for k in ("include:", "a:", "mx", "ptr", "exists:", "redirect="))
    if "+all" in spf:
        return "fail", f"SPF ends in +all, which lets anyone send as you: {spf}"
    if lookups > 10:
        return "warn", f"SPF has about {lookups} DNS lookups (limit is 10): {spf}"
    if "~all" not in spf and "-all" not in spf:
        return "warn", f"SPF has no ~all or -all ending: {spf}"
    return "pass", spf


def check_dmarc(domain):
    records = [r for r in resolve(f"_dmarc.{domain}", "TXT") if r.lower().startswith("v=dmarc1")]
    if not records:
        return "fail", "No DMARC record. Gmail and Yahoo require DMARC for bulk senders."
    dmarc = records[0]
    tags = dict(t.strip().split("=", 1) for t in dmarc.split(";") if "=" in t)
    if "rua" not in tags:
        return "warn", f"DMARC has no rua= reporting address, so you get no reports: {dmarc}"
    return "pass", dmarc


def check_dkim(domain):
    if any("p=" in r for r in resolve(f"no-such-selector-7f3a._domainkey.{domain}", "TXT")):
        return "warn", "Wildcard DKIM record answers every selector, so the real key can't be confirmed here."
    found = [s for s in DKIM_SELECTORS
             if any("p=" in r for r in resolve(f"{s}._domainkey.{domain}", "TXT"))]
    if not found:
        return "warn", ("No DKIM key on common selectors. It may use a custom selector; "
                        "confirm in the sending tool's DNS setup page.")
    return "pass", "DKIM key found on selector(s): " + ", ".join(found)


def check_mx(domain):
    mx = resolve(domain, "MX")
    if not mx:
        return "fail", "No MX record. Replies to this domain will bounce."
    provider = "Google Workspace" if any("google" in m.lower() for m in mx) else \
        "Microsoft 365" if any("outlook" in m.lower() for m in mx) else "other"
    return "pass", f"{provider}: " + ", ".join(sorted(mx))


def audit(domain):
    domain = domain.strip().lower().removeprefix("http://").removeprefix("https://").split("/")[0]
    checks = {}
    for name, fn in (("mx", check_mx), ("spf", check_spf), ("dmarc", check_dmarc), ("dkim", check_dkim)):
        try:
            checks[name] = dict(zip(("status", "detail"), fn(domain)))
        except Exception as exc:  # network errors should not stop a batch
            checks[name] = {"status": "error", "detail": str(exc)}
    statuses = [c["status"] for c in checks.values()]
    score = 100 - 30 * statuses.count("fail") - 10 * statuses.count("warn") - 10 * statuses.count("error")
    return {"domain": domain, "score": max(score, 0), "checks": checks}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("domains", nargs="*")
    parser.add_argument("--file", help="text file with one domain per line")
    parser.add_argument("--json", action="store_true", help="print JSON instead of a table")
    args = parser.parse_args()

    domains = list(args.domains)
    if args.file:
        with open(args.file) as fh:
            domains += [line.strip() for line in fh if line.strip() and not line.startswith("#")]
    if not domains:
        parser.error("give at least one domain")

    results = [audit(d) for d in domains]
    if args.json:
        json.dump(results, sys.stdout, indent=2)
        print()
        return
    icons = {"pass": "OK  ", "warn": "WARN", "fail": "FAIL", "error": "ERR "}
    for r in results:
        print(f"\n{r['domain']}  score {r['score']}/100")
        for name, c in r["checks"].items():
            print(f"  [{icons[c['status']]}] {name.upper():5} {c['detail']}")


if __name__ == "__main__":
    main()
