# Release signing key

Release APKs are signed with `companion-release.jks` (alias `companion`). Android only installs an update
when it is signed with the same key as the app already on the phone, so this key must never change or be lost.

The key and `release.properties` (its passwords) are **not in git**. Keep a backup somewhere safe, for
example a password manager. To build a release on a new machine, put both files back in this folder:

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

Certificate SHA-256: `80:81:68:8B:71:FF:39:E7:62:03:AB:AD:B5:9C:51:C1:57:83:EC:53:68:0D:94:8C:9F:C7:34:11:34:D8:25:7B`

## Building on GitHub (Actions → Android APK → release)

The workflow reads the key from four repository secrets (Settings → Secrets and variables → Actions). It deletes the key after the build and fails if the APK isn't signed with the certificate above:

- `ANDROID_KEYSTORE_BASE64`: the output of `base64 -w0 companion-release.jks`
- `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`companion`), `ANDROID_KEY_PASSWORD`: the values from `release.properties`
