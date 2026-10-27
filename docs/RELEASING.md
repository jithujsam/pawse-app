# Releasing Pawse

Every Pawse release ends with an update to the distribution repository, **`jithujsam/pawse-releases`**. The repo name is plural; some prompts say "pawse-release", but that repository doesn't exist. The app reads `https://raw.githubusercontent.com/jithujsam/pawse-releases/main/latest.json` (`apps/web/src/update.ts`). Whatever is on that repo's `main` is what phones are offered.

> **Pushing to `pawse-releases/main` *is* publishing.** Installed apps check `latest.json` on launch and offer the update immediately.
>
> **Standing owner approval (2026-10-25):** the owner is currently the only user, and needs every new build on their phone to test it. So **every verified, signed release APK is published to `pawse-releases/main` straight away, as soon as it is compiled.** No PR and no separate approval step. The checks in "Non-negotiable rules" still apply and are what makes this safe. Revisit this when there are other users: go back to a reviewed PR and the owner's merge.

## How `pawse-releases` distributes builds (verified 2026-10-24)

| File | Role | Read by |
|---|---|---|
| `apk/Pawse-<version>.apk` | The signed release APK, one file per version. Older ones stay. | People downloading; the update banner opens its URL |
| `latest.json` | One-line update manifest: `{ "name", "code", "url", "notes", "sha256" }` | The app (`checkUpdate`): it offers the update when `code` > its own version code and `url` is on `raw.githubusercontent.com/jithujsam/pawse-releases/`. `name` and `notes` show in the launch popup and the Home banner; `notes` may have several lines (`\n`), one per row. `sha256` is also what the in-app installer checks the download against: with a valid 64-character `sha256` the app downloads the APK itself and opens Android's installer; without one it falls back to opening `url` in the browser. The app checks on launch and when it is reopened (at most hourly). There is no background notification: people see the popup when they open Pawse. |
| `README.md` | Download page: the download link (version, size), install steps, a **Versions** table (newest first), and the SHA-256 of the current APK | People |
| `icon.png` | Page icon | README |

Releases are plain files on `main`. The repo doesn't use GitHub Releases or tags.

**Currently published (checked 2026-10-27):** 3.9.12, code 39, matching `apps/web/version.json` and the live `latest.json`. The build history, with each release's pawse-app commit, is in `pawse-releases/RELEASE_STATUS.md`.
- The file's SHA-256 is `9648ef63…fb89ef3`, matching `latest.json` and the README.
- The publish workflow writes the entry, so the procedure below is kept to the check-and-verify steps.

## Non-negotiable rules

1. **Only a verified release build goes in.** It must be a signed release APK (`assembleRelease` with the release key), not a debug build, not unsigned, and not one that failed any release check. It must come from a reviewed commit on `pawse-app/main` that passed tests, typecheck and build, with the device tests passed.
2. **Never invent anything.** Every URL, checksum, size and version in `latest.json` and the README comes from the actual file being published, measured with the commands below.
3. **One build everywhere.** The APK filename, `latest.json` (`name`, `code`, `url`, `sha256`), the README link, the Versions row and the SHA-256 line all describe the same file. So does the version baked into that APK.
4. **Never go backwards.** The new `code` must be greater than the published `code`, and the filename must not already exist. Never replace an existing APK file in place.
5. **Keep history.** Older APKs and older Versions rows stay.
6. **Signing credentials are a blocker, not a hurdle.** Signing needs the owner's keystore, which isn't in git. An agent or run without it can't publish: it reports the blocker and never publishes a debug, unsigned or differently signed APK. Publishing itself needs no further approval while the standing approval above is in force.

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
**In a Claude cloud session (the usual way):** the owner stores the key bundle in the environment as the variable `ANDROID_RELEASE_BUNDLE` (the base64 of a `.tar.gz` holding `companion-release.jks` and `release.properties`). A new session has it. Unpack it into the git-ignored keystore folder, then build locally as below, and never print it or commit it:
```
base64 -d <<<"$ANDROID_RELEASE_BUNDLE" | tar -xz -C apps/web/android/keystore companion-release.jks release.properties
```
The Android SDK isn't preinstalled: download Google's command-line tools, accept the licences, and `sdkmanager "platforms;android-35" "build-tools;35.0.0"` (Java 21 is already there). Run step 3's checks, then step 4 straight to `main`.

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

### 4. Publish to `pawse-releases` (the workflow does this)
**Usual way:** Actions → **Android APK** → Run workflow, on `main`, with `build_type` = `release`, `publish` ticked, and `release_notes` = one line of plain-language notes. The `apk` job builds and verifies the signed APK. The `publish` job runs `.github/scripts/publish-release.py`, which checks the APK again and writes `apk/`, `latest.json`, the README (download link, Versions row, SHA line) and `RELEASE_STATUS.md`. It then commits and pushes to `pawse-releases` `main`, and checks that the published APK's SHA-256 matches. It needs the `PAWSE_RELEASES_TOKEN` secret: a fine-grained token with contents write on `jithujsam/pawse-releases` only. The script refuses a lower or equal code, an existing APK file, or any mismatch, and then nothing is pushed.

**By hand (if the workflow can't run):** the manual edits below. Without the standing approval, use a branch and PR instead.
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
- Commit with a message like `Pawse <new name>: APK, update manifest and notes (pawse-app <short sha>)`, then push. Straight to `main` publishes at once (standing approval); on a branch, open a PR and **don't merge it**: merging publishes.

### 5. Publish
Under the standing approval, the push to `main` in step 4 is the publish. Go to step 6. Otherwise the owner reviews the PR (APK provenance, the step 3 output, the notes) and merges it. That's the moment phones get offered the update.

### 6. Verify the published release
```
curl -s "https://raw.githubusercontent.com/jithujsam/pawse-releases/main/latest.json?t=$(date +%s)"   # shows the new name/code
curl -sL "<url from latest.json>" | sha256sum                                                        # equals latest.json sha256
```
Raw GitHub can cache for a few minutes, so retry before worrying. Then, on a phone running the previous version: the home screen shows "Update available"; installing it over the old one keeps the pet and history.

### If a release is bad
Android won't install a lower version code over a higher one, so there's no rollback for phones that already updated. To stop offering a bad build, revert `latest.json` to the previous entry in a PR. Ship the fix as a new, higher version. Never overwrite the bad APK file; leave it, and note it in the Versions table.

## Agents and future sessions
- Every release task must end with steps 1–4 for `pawse-releases`, which publishes under the standing approval, and then step 6. This is also stated in `CLAUDE.md`.
- If there's no verified, signed release candidate, don't touch `apk/` or `latest.json`. Report "unreleased" and the blocking item.
- If GitHub permissions block a push or PR to `pawse-releases`, report the exact error and leave the prepared files and commands in the report.
