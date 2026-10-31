# Releasing Pawse (quick path)

Distribution repo: `jithujsam/pawse-releases` (plural). Phones read its `main/latest.json`, so **a push to `main` there is a live release.** Standing owner approval (2026-10-25, sole user): publish every verified, signed release APK straight to `main`, no PR.

## Rules
1. Signed release builds only. Never debug or unsigned.
2. Never invent a URL, size, checksum or version. Everything comes from the real APK.
3. New `code` must be higher than the published one; the APK filename must be new; never overwrite an APK; keep old rows.
4. No signing key or token means a blocker: report it, publish nothing.

## Steps
1. **Gate.** Changes merged to `pawse-app/main`, and CI green on that commit. Bump `apps/web/version.json` (`name`, `code`) on `main` and commit.
2. **Publish.** Run the **Android APK** workflow on `main` (`mcp__github__actions_run_trigger`, workflow `android.yml`) with `build_type=release`, `publish=true`, `release_notes=<one plain line>`. It lints, tests, builds, verifies the signature, version and debuggable flag, writes `apk/`, `latest.json`, README and `RELEASE_STATUS.md`, pushes, and re-checks the SHA-256. It refuses a lower code or an existing file.
3. **Verify.** `scripts/verify-release.sh` prints PASS/FAIL for the live `latest.json` and download (code, URL, SHA-256). Retry after a few minutes if raw GitHub is cached.
4. **Report** the version, code, SHA-256 and the `pawse-app` commit.

If the workflow fails, read the failing job's log first. Only then open `docs/RELEASING_MANUAL.md` (manual build and publish, rollback of a bad release, file roles). A bad release is never overwritten: revert `latest.json` to the previous entry and ship a higher version.
