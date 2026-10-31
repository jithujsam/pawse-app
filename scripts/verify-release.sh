#!/usr/bin/env bash
# Verify the live Pawse release on pawse-releases. Optionally also check a local APK.
# Usage: scripts/verify-release.sh [path/to/app-release.apk]
# Needs: curl, sha256sum, python3. A local APK also uses apksigner/aapt2 from $ANDROID_HOME/build-tools if present.
set -u
BASE="https://raw.githubusercontent.com/jithujsam/pawse-releases/main"
KEY="10ab3feb74724e2e38161c8027e679438a89d3521525980fbbd796ad62faa9f8"
fail=0
ok()  { echo "PASS  $*"; }
bad() { echo "FAIL  $*"; fail=1; }

cd "$(dirname "$0")/.." || exit 2
want=$(python3 -c 'import json;j=json.load(open("apps/web/version.json"));print(j["name"],j["code"])')
wname=${want% *}; wcode=${want#* }

if [ $# -ge 1 ]; then
  apk=$1
  [ -f "$apk" ] || { echo "FAIL  no such file: $apk"; exit 1; }
  bt=$(ls -d "${ANDROID_HOME:-/nonexistent}"/build-tools/* 2>/dev/null | sort -V | tail -1)
  if [ -n "$bt" ]; then
    out=$("$bt/apksigner" verify --verbose --print-certs "$apk" 2>&1)
    echo "$out" | grep -Eq 'Verified using v[23] scheme.*true' && ok "signature v2/v3" || bad "signature"
    echo "$out" | grep -q "certificate SHA-256 digest: $KEY" && ok "release certificate" || bad "certificate is not the release key"
    b=$("$bt/aapt2" dump badging "$apk")
    echo "$b" | grep -q "name='app.detoxcompanion' versionCode='$wcode' versionName='$wname'" && ok "package/version $wname ($wcode)" || bad "package/version"
    [ "$(echo "$b" | grep -c application-debuggable)" = 0 ] && ok "not debuggable" || bad "debuggable build"
  else
    echo "SKIP  apksigner/aapt2 not found (set ANDROID_HOME); signature and version not checked"
  fi
  unzip -p "$apk" 'assets/public/assets/*.js' | grep -o 'name:"[0-9.]*",code:[0-9]*' | sort -u | grep -q "name:\"$wname\",code:$wcode" \
    && ok "web bundle version" || bad "web bundle version"
  echo "INFO  sha256 $(sha256sum "$apk" | cut -d' ' -f1)  size $(stat -c %s "$apk") bytes"
fi

json=$(curl -fsS "$BASE/latest.json?t=$(date +%s)") || { echo "FAIL  cannot fetch latest.json"; exit 1; }
read -r name code url sha < <(python3 -c 'import json,sys;j=json.loads(sys.argv[1]);print(j["name"],j["code"],j["url"],j.get("sha256",""))' "$json")
[ "$name" = "$wname" ] && [ "$code" = "$wcode" ] && ok "latest.json is $name ($code), matches version.json" || bad "latest.json is $name ($code), version.json says $wname ($wcode)"
case "$url" in "$BASE"/apk/Pawse-"$name".apk) ok "url";; *) bad "url $url";; esac
[ "${#sha}" = 64 ] && ok "sha256 present" || bad "sha256 missing or malformed"
got=$(curl -fsSL "$url" | sha256sum | cut -d' ' -f1)
[ "$got" = "$sha" ] && ok "download matches sha256 ${sha:0:12}…" || bad "download sha256 $got != $sha"
grep_readme=$(curl -fsS "$BASE/README.md?t=$(date +%s)")
echo "$grep_readme" | grep -q "$sha" && echo "$grep_readme" | grep -q "| $name |" && ok "README has sha256 and Versions row" || bad "README out of sync"

[ $fail = 0 ] && echo "RELEASE OK" || echo "RELEASE HAS FAILURES"
exit $fail
