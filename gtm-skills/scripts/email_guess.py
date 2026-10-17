#!/usr/bin/env python3
"""Generate likely work-email candidates for people at a company, free.

Reads a CSV with first_name, last_name and domain columns, checks that the
domain accepts mail (MX via DNS-over-HTTPS) and writes ranked email
candidates. It does not ping mail servers, so it never burns your IP; run
the top candidate through a verifier (or your sending tool's built-in
check) before sending.

If you already know one real address at the company (from the website,
a press release, GitHub commits), pass --known to lock the pattern.

Usage:
    python3 email_guess.py leads.csv -o leads_with_emails.csv
    python3 email_guess.py leads.csv --known jane.doe@acme.com
"""
import argparse
import csv
import json
import re
import unicodedata
import urllib.parse
import urllib.request

# Ordered by how common the pattern is across B2B companies.
PATTERNS = [
    "{f}.{l}", "{f}", "{f}{l}", "{fi}{l}", "{f}_{l}", "{fi}.{l}", "{f}{li}", "{l}.{f}", "{l}",
]


def clean(name):
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z]", "", name.lower())


def render(pattern, first, last):
    return pattern.format(f=first, l=last, fi=first[:1], li=last[:1])


def detect_pattern(known_email, first, last):
    local = known_email.split("@")[0].lower()
    for p in PATTERNS:
        if render(p, first, last) == local:
            return p
    return None


def has_mx(domain, cache={}):
    if domain not in cache:
        query = urllib.parse.urlencode({"name": domain, "type": "MX"})
        try:
            with urllib.request.urlopen(f"https://dns.google/resolve?{query}", timeout=10) as resp:
                cache[domain] = bool(json.load(resp).get("Answer"))
        except Exception:
            cache[domain] = None
    return cache[domain]


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("csv_in")
    parser.add_argument("-o", "--out", default="leads_with_emails.csv")
    parser.add_argument("--known", help="a real address at the same domain, e.g. jane.doe@acme.com")
    parser.add_argument("--known-name", help="'First Last' of the --known address owner")
    args = parser.parse_args()

    locked = {}
    if args.known:
        if not args.known_name:
            parser.error("--known needs --known-name 'First Last'")
        first, last = (clean(p) for p in args.known_name.split(maxsplit=1))
        pattern = detect_pattern(args.known, first, last)
        if not pattern:
            parser.error(f"could not match {args.known} to a known pattern")
        locked[args.known.split("@")[1].lower()] = pattern

    with open(args.csv_in, newline="") as fh:
        rows = list(csv.DictReader(fh))
    missing = {"first_name", "last_name", "domain"} - set(rows[0] if rows else {})
    if missing:
        parser.error(f"CSV is missing columns: {', '.join(sorted(missing))}")

    for row in rows:
        first, last = clean(row["first_name"]), clean(row["last_name"])
        domain = row["domain"].strip().lower().removeprefix("www.")
        row["domain_accepts_mail"] = {True: "yes", False: "no", None: "unknown"}[has_mx(domain)]
        patterns = [locked[domain]] if domain in locked else PATTERNS[:4]
        candidates = [f"{render(p, first, last)}@{domain}" for p in patterns
                      if first and row["domain_accepts_mail"] != "no"]
        row["email_best_guess"] = candidates[0] if candidates else ""
        row["email_alternatives"] = " | ".join(candidates[1:])
        row["email_confidence"] = "pattern-confirmed" if domain in locked else "guess"

    with open(args.out, "w", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} rows to {args.out}")


if __name__ == "__main__":
    main()
