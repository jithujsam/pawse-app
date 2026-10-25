# Releasing Pawse

Every Pawse release ends with an update to the distribution repository, **`jithujsam/pawse-releases`**. The repo name is plural; some prompts say "pawse-release", but that repository doesn't exist. The app reads `https://raw.githubusercontent.com/jithujsam/pawse-releases/main/latest.json` (`apps/web/src/update.ts`). Whatever is on that repo's `main` is what phones are offered.

> **Merging a change into `pawse-releases/main` *is* publishing.** Installed apps check `latest.json` on launch and offer the update immediately. Treat that merge as the production release step: it needs the owner's approval.

## How `pawse-releases` distributes builds (verified 2026-10-24)

| File | Role | Read by |
|---|---|---|
| `apk/Pawse-<version>.apk` | The signed release APK, one file per version. Older ones stay. | People downloading; the update banner opens its URL |
| `latest.json` | One-line update manifest: `{ "name", "code", "url", "notes", "sha256" }` | The app (`checkForUpdate`): it offers the update when `code` > its own version code and `url` starts with `https://`. `name` and `notes` show in the banner. `sha256` is for people verifying by hand; the app doesn't check it. |
| `README.md` | Download page: the download link (version, size), install steps, a **Versions** table (newest first), and the SHA-256 of the current APK | People |
| `icon.png` | Page icon | README |

Releases are plain files on `main`. The repo doesn't use GitHub Releases or tags.

**Currently published, and checked:** 2.1.0, code 7.
- `latest.json`, the README and `apk/Pawse-2.1.0.apk` agree.
- The file's SHA-256 is `c8801d33…cba53`, matching both.
- The APK is signed with the release key: certificate SHA-256 `80:81:68:8B:…:25:7B`, as in `apps/web/android/keystore/README.md`. It has a v2/v3 signing block.
- The web bundle inside it reports `name:"2.1.0",code:7`.
- **Unknown:** which `pawse-app` commit it was built from. The APK records no version-control info, which is why the procedure now records the source commit.

## Non-negotiable rules

1. **Only a verified release build goes in.** It must be a signed release APK (`assembleRelease` with the release key), not a debug build, not unsigned, and not one that failed any release check. It must come from a reviewed commit on `pawse-app/main` that passed tests, typecheck and build, with the device tests passed.
2. **Never invent anything.** Every URL, checksum, size and version in `latest.json` and the README comes from the actual file being published, measured with the commands below.
3. **One build everywhere.** The APK filename, `latest.json` (`name`, `code`, `url`, `sha256`), the README link, the Versions row and the SHA-256 line all describe the same file. So does the version baked into that APK.
4. **Never go backwards.** The new `code` must be greater than the published `code`, and the filename must not already exist. Never replace an existing APK file in place.
5. **Keep history.** Older APKs and older Versions rows stay.
6. **Approval, signing credentials and security review are blockers, not hurdles.** Signing needs the owner's keystore, which isn't in git, and publishing needs the owner's approval. An agent without both prepares everything up to the PR and reports the blocker; it never merges to `pawse-releases/main` itself.

## Procedure

### 0. Gate: is there a release candidate?
All of these must be true, with evidence. Otherwise stop and record "unreleased".
- The changes are reviewed and merged to `pawse-app/main`. Record the commit: `git rev-parse HEAD`.
- On that commit, all of these pass: `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- The production steps the release depends on are done (see `docs/PAWSE_OVERNIGHT_LOG.md` → Release instructions: secret, function deploy, migrations, auth settings).
- The device test plan in that log passed on the signed build from step 2.

### 1. Check what's published now
```
curl -s "https://raw.githubusercontent.com/jithujsam/pawse-releases/main/latest.json?t=$(date +%s)"
```
Note the published `name` and `code`. The new version must have a higher `code` and a new `name`. Also check that `apk/Pawse-<new name>.apk` doesn't exist yet.

### 2. Build the signed release APK (from the gate commit, clean tree)
**Easiest: build on GitHub.** Actions → **Android APK** → Run workflow → `release`, on `main`. It runs lint, typecheck and tests, builds, then checks the package, version, embedded web version, debuggable flag and the release certificate, and fails if any of them is wrong. The run's artifact holds the APK plus `BUILD-INFO.txt` (version, commit, build type, certificate, SHA-256, test results). It needs the `ANDROID_RELEASE_BUNDLE` secret described in `apps/web/android/keystore/README.md`. Without it the release build refuses to run. `release-unsigned` builds the same APK without a signature, to sign on a machine that has the key. Every PR and push to `main` also produces a **debug** test APK (`app.detoxcompanion.test`, "Pawse Test"), which installs next to the real app and never replaces it or its data. Debug APKs are never published.

**Or build locally:**
```
cd pawse-app && git checkout main && git pull && git status   # must be clean, at the gate commit
# apps/web/version.json: { "name": "<new name>", "code": <published code + 1 or more> }, committed to main
# keystore files in apps/web/android/keystore/ (see the README there; never commit them)
pnpm install --frozen-lockfile
pnpm --filter web build
cd apps/web && npx cap sync android
cd android && ANDROID_HOME=/path/to/sdk ./gradlew assembleRelease
# -> apps/web/android/app/build/outputs/apk/release/app-release.apk
```
If `release.properties` is missing, Gradle produces an unsigned APK. That's a blocker: stop.

### 3. Verify the artifact (all must pass)
Run these in `apps/web/android/app/build/outputs/apk/release/`, with `BT=$ANDROID_HOME/build-tools/<version>`:
```
$BT/apksigner verify --verbose --print-certs app-release.apk
#   "Verified using v2 scheme (APK Signature Scheme v2): true" (or v3), and
#   "Signer #1 certificate SHA-256 digest: 10ab3feb74724e2e38161c8027e679438a89d3521525980fbbd796ad62faa9f8" (the key since 3.0.0; see apps/web/android/keystore/README.md)
$BT/aapt2 dump badging app-release.apk | head -3
#   package: name='app.detoxcompanion' versionCode='<new code>' versionName='<new name>'
$BT/aapt2 dump badging app-release.apk | grep -c application-debuggable    # must print 0
unzip -p app-release.apk 'assets/public/assets/*.js' | grep -o 'name:"[0-9.]*",code:[0-9]*' | sort -u
#   name:"<new name>",code:<new code>   (the web bundle inside matches)
sha256sum app-release.apk          # the checksum to publish
ls -l app-release.apk              # README size = bytes / 1,000,000, one decimal (4,813,364 bytes -> "4.8 MB")
```
Without the build tools, `keytool -printcert -jarfile app-release.apk` shows the (v1) certificate as a weaker fallback. Record that `apksigner` wasn't run.

*Checked on 2026-10-24 against the published 2.1.0:* the `unzip … | grep` version check, `keytool -printcert -jarfile`, `sha256sum` and the step 4 consistency script all gave the expected results (`OK 2.1.0 7`). `apksigner` and `aapt2` aren't installed where this was written; they're the standard Android build-tools commands for the build machine.

### 4. Prepare the `pawse-releases` change (on a branch, as a PR)
```
git clone https://github.com/jithujsam/pawse-releases && cd pawse-releases
git checkout -b release/<new name>
cp <path>/app-release.apk apk/Pawse-<new name>.apk
sha256sum apk/Pawse-<new name>.apk       # must equal step 3's value
```
- **`latest.json`:** replace its contents. Keep the one-line style:
  `{ "name": "<new name>", "code": <new code>, "url": "https://raw.githubusercontent.com/jithujsam/pawse-releases/main/apk/Pawse-<new name>.apk", "notes": "<one short line>", "sha256": "<step 3 value>" }`
- **`README.md`:**
  - the download link text and URL become the new version and size;
  - add a new row at the **top** of the Versions table (`| <new name> | <YYYY-MM-DD> | <what's new> |`), keeping the older rows;
  - the "SHA-256 of Pawse-<new name>.apk" line becomes the new value.
- **Release notes:** say what changed for users, in plain words. In the PR description, also give the `pawse-app` commit and PR the build came from, plus the step 3 output.
- **Consistency check** before committing. It must print OK:
  ```
  python3 - <<'EOF'
  import json, hashlib, os, re
  j = json.load(open("latest.json")); f = "apk/Pawse-%s.apk" % j["name"]
  assert os.path.exists(f), f
  assert j["url"] == "https://raw.githubusercontent.com/jithujsam/pawse-releases/main/" + f, j["url"]
  assert hashlib.sha256(open(f, "rb").read()).hexdigest() == j["sha256"], "checksum"
  r = open("README.md").read()
  assert j["sha256"] in r and ("Pawse-%s.apk" % j["name"]) in r and ("| %s |" % j["name"]) in r, "README"
  print("OK", j["name"], j["code"])
  EOF
  ```
- Commit with a message like `Pawse <new name>: APK, update manifest and notes (pawse-app <short sha>)`, then push the branch and open a PR. **Don't merge it**: merging publishes.

### 5. Publish (the owner)
The owner reviews the PR (APK provenance, the step 3 output, the notes) and merges it. That's the moment phones get offered the update.

### 6. Verify the published release
```
curl -s "https://raw.githubusercontent.com/jithujsam/pawse-releases/main/latest.json?t=$(date +%s)"   # shows the new name/code
curl -sL "<url from latest.json>" | sha256sum                                                        # equals latest.json sha256
```
Raw GitHub can cache for a few minutes, so retry before worrying. Then, on a phone running the previous version: the home screen shows "Update available"; installing it over the old one keeps the pet and history.

### If a release is bad
Android won't install a lower version code over a higher one, so there's no rollback for phones that already updated. To stop offering a bad build, revert `latest.json` to the previous entry in a PR. Ship the fix as a new, higher version. Never overwrite the bad APK file; leave it, and note it in the Versions table.

## Agents and future sessions
- Every release task must end with step 1–4 for `pawse-releases`, and step 6 after the owner merges. This is also stated in `CLAUDE.md`.
- If there's no verified, signed release candidate, don't touch `apk/` or `latest.json`. Report "unreleased" and the blocking item.
- If GitHub permissions block a push or PR to `pawse-releases`, report the exact error and leave the prepared files and commands in the report.
