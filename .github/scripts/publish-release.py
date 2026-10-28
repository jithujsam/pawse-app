#!/usr/bin/env python3
"""Write a verified release into a checkout of jithujsam/pawse-releases.

The publish job in .github/workflows/android.yml runs this after the apk job has built and verified
the signed APK. It re-checks the APK and BUILD-INFO.txt, and checks every rule in docs/RELEASING.md,
before it writes anything. Then it updates the APK, latest.json, README.md and RELEASE_STATUS.md in the
checkout and re-checks what it wrote. The workflow commits and pushes the result. Standard library only.
"""

import argparse
import datetime
import hashlib
import json
import os
import re
import shutil
import sys

RELEASE_CERT = "10ab3feb74724e2e38161c8027e679438a89d3521525980fbbd796ad62faa9f8"
RAW = "https://raw.githubusercontent.com/jithujsam/pawse-releases/main/"
VERSIONS_HEADER = "| Version | Date | What's new |\n|---|---|---|\n"


def fail(message):
    print(f"::error::{message}")
    sys.exit(1)


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def write(path, text):
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def replace_once(text, pattern, replacement, what):
    """Replace the one match of a regex, or fail. A file that doesn't match is never guessed at."""
    new, count = re.subn(pattern, lambda _: replacement, text, flags=re.M)
    if count != 1:
        fail(f"Expected one {what}, found {count}.")
    return new


def read_build_info(path):
    info = {}
    for line in read(path).splitlines():
        if ": " in line:
            key, value = line.split(": ", 1)
            info[key] = value
    return info


def main():
    parser = argparse.ArgumentParser(description="Write a verified release into pawse-releases.")
    parser.add_argument("--build-dir", required=True, help="folder with the verified APK and BUILD-INFO.txt")
    parser.add_argument("--releases", required=True, help="checkout of jithujsam/pawse-releases")
    parser.add_argument("--notes", required=True, help="one line of plain-language release notes")
    args = parser.parse_args()

    notes = " ".join(args.notes.split())
    if not notes:
        fail("Release notes are required.")

    # 1. The APK must be the verified release build the apk job described.
    info = read_build_info(os.path.join(args.build_dir, "BUILD-INFO.txt"))
    if info.get("Build type") != "release":
        fail(f"Only a signed release build can be published, not '{info.get('Build type')}'.")
    if info.get("Signing certificate SHA-256") != RELEASE_CERT:
        fail("The APK isn't signed with the release certificate.")
    if info.get("Debuggable") != "no":
        fail("The APK is debuggable.")
    match = re.fullmatch(r"(\S+) \(code (\d+)\)", info.get("Version", ""))
    if not match:
        fail("Can't read the version from BUILD-INFO.txt.")
    name, code = match.group(1), int(match.group(2))
    date = info.get("Built", "")[:10]
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
        fail("Can't read the build date from BUILD-INFO.txt.")

    apk_src = os.path.join(args.build_dir, info.get("File", ""))
    if not os.path.isfile(apk_src):
        fail(f"APK not found: {info.get('File')}")
    with open(apk_src, "rb") as f:
        apk = f.read()
    sha = hashlib.sha256(apk).hexdigest()
    if sha != info.get("SHA-256"):
        fail("The APK's SHA-256 doesn't match BUILD-INFO.txt.")
    if info.get("Size") != f"{len(apk)} bytes":
        fail("The APK's size doesn't match BUILD-INFO.txt.")

    # 2. Never go backwards, never replace a file, never drop history.
    rel = args.releases
    latest_path = os.path.join(rel, "latest.json")
    published = json.loads(read(latest_path))
    if code <= published["code"]:
        fail(f"Code {code} isn't higher than the published {published['code']}. Never publish a lower or equal code.")
    apk_rel = f"apk/Pawse-{name}.apk"
    apk_dst = os.path.join(rel, apk_rel)
    if os.path.exists(apk_dst):
        fail(f"{apk_rel} already exists. Never replace an APK.")
    readme_path = os.path.join(rel, "README.md")
    status_path = os.path.join(rel, "RELEASE_STATUS.md")
    readme = read(readme_path)
    status = read(status_path)
    if f"| {name} | " in readme:
        fail(f"README.md already lists {name}.")

    # 3. Edit the text. Each edit must match exactly once, or nothing is written.
    size = f"{len(apk) / 1_000_000:.1f} MB"
    readme = replace_once(
        readme,
        r'<a href="https://raw\.githubusercontent\.com/jithujsam/pawse-releases/main/apk/Pawse-[^"]+\.apk"><b>Download pawse [^<]*</b></a>',
        f'<a href="{RAW}{apk_rel}"><b>Download pawse {name} for Android (APK, {size})</b></a>',
        "download link in README.md",
    )
    if readme.count(VERSIONS_HEADER) != 1:
        fail("Expected one Versions table header in README.md.")
    cell = notes.replace("|", "\\|")
    readme = readme.replace(VERSIONS_HEADER, VERSIONS_HEADER + f"| {name} | {date} | {cell} |\n", 1)
    readme = replace_once(
        readme,
        r"\*\*SHA-256 of Pawse-[^*]+\.apk:\*\* `[0-9a-f]{64}`",
        f"**SHA-256 of Pawse-{name}.apk:** `{sha}`",
        "SHA-256 line in README.md",
    )

    status = replace_once(status, r"^Updated: .*$", f"Updated: {date} ({name} release)", "Updated line in RELEASE_STATUS.md")
    marker = re.search(r"^## ", status, flags=re.M)
    if not marker:
        fail("RELEASE_STATUS.md has no release section to add to.")
    tests = info.get("Tests (schema, engine, web)", "see BUILD-INFO.txt")
    section = (
        f"## {name} release (published to main by the publish workflow)\n\n"
        "| Version | Code | File | SHA-256 | Signed with |\n"
        "|---|---|---|---|---|\n"
        f"| {name} | {code} | `{apk_rel}` ({len(apk)} bytes) | `{sha}` | Release key, certificate SHA-256 `{RELEASE_CERT}` |\n\n"
        f"**Provenance.** Commit `{info.get('Commit', '')}`, built {info.get('Built', '')}. Tests: {tests}.\n\n"
    )
    status = status[: marker.start()] + section + status[marker.start():]

    # 4. Write the files, then check that they agree with each other.
    shutil.copyfile(apk_src, apk_dst)
    # The versions before this one, newest first, so the app can show every update a person has missed.
    previous = {"name": published["name"], "code": published["code"], "notes": published.get("notes", "")}
    history = [previous] + [h for h in published.get("history", []) if h["code"] < code]
    latest = {"name": name, "code": code, "url": RAW + apk_rel, "notes": notes, "sha256": sha, "history": history[:10]}
    write(latest_path, json.dumps(latest, ensure_ascii=False) + "\n")
    write(readme_path, readme)
    write(status_path, status)

    with open(apk_dst, "rb") as f:
        if hashlib.sha256(f.read()).hexdigest() != sha:
            fail("The APK file in the checkout doesn't match its checksum.")
    if json.loads(read(latest_path)) != latest:
        fail("latest.json doesn't match the release.")
    readme = read(readme_path)
    if sha not in readme or f"Pawse-{name}.apk" not in readme or f"| {name} |" not in readme:
        fail("README.md doesn't match the release.")
    if sha not in read(status_path):
        fail("RELEASE_STATUS.md doesn't match the release.")
    print(f"OK {name} {code}")


if __name__ == "__main__":
    main()
