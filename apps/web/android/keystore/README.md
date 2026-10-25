# Release signing key

Release APKs are signed with `companion-release.jks` (alias `companion`). Android only installs an update
when it is signed with the same key as the app already on the phone, so this key must never change or be lost.

The key and `release.properties` (its passwords) are **not in git**. The owner keeps the backup (a private
file in their Google Drive, created 2026-10-25). To build a release on a new machine, put both files back in this folder:

```
apps/web/android/keystore/companion-release.jks
apps/web/android/keystore/release.properties
```

`release.properties` looks like:

```
storeFile=../keystore/companion-release.jks
storePassword=...
keyAlias=companion
keyPassword=...
```

Without them, `assembleRelease` produces an unsigned APK that phones won't install as an update.

Certificate SHA-256 (current key, since 3.0.0):
`10:AB:3F:EB:74:72:4E:2E:38:16:1C:80:27:E6:79:43:8A:89:D3:52:15:25:98:0F:BB:D7:96:AD:62:FA:A9:F8`

**Key history.** Versions up to 2.1.0 were signed with an earlier key (certificate
`80:81:68:8B:…:25:7B`). That key existed only on a temporary build machine and was lost, so 3.0.0 can't
install over 2.1.0. People on 2.1.0 uninstall it once and install 3.0.0; signing in brings their account's
pet and history back. Anything not yet synced to the account is lost.

## Building on GitHub (Actions → Android APK)

- **release**: signs on GitHub. Needs one repository secret, `ANDROID_RELEASE_BUNDLE` (Settings → Secrets
  and variables → Actions). Its value is the output of
  `tar -czf - companion-release.jks release.properties | base64 -w0`, run in this folder. The workflow
  deletes the key after the build and fails unless the APK carries the certificate above.
- **release-unsigned**: builds the release without a signature, for signing on a machine that has the key:
  `zipalign -c -p 4 in.apk`, then `apksigner sign --ks companion-release.jks --ks-key-alias companion --out Pawse-<version>.apk in.apk`.
