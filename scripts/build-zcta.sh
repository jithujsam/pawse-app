#!/usr/bin/env bash
# Rebuilds data/us-zcta.csv (zip,lat,lng) from the Census Gazetteer (public domain).
#   ZCTA_YEAR=2024 scripts/build-zcta.sh
set -euo pipefail
cd "$(dirname "$0")/.."

YEAR="${ZCTA_YEAR:-2024}"
URL="https://www2.census.gov/geo/docs/maps-data/data/gazetteer/${YEAR}_Gazetteer/${YEAR}_Gaz_zcta_national.zip"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

curl -sSfL "$URL" -o "$WORK/zcta.zip"
unzip -q -o "$WORK/zcta.zip" -d "$WORK"

# Tab-separated with padded headers; pick columns by name since the column set changes between years.
awk -F'\t' 'NR == 1 { for (i = 1; i <= NF; i++) { gsub(/ /, "", $i); col[$i] = i }; next }
            { gsub(/ /, "", $col["INTPTLONG"]); printf "%s,%.5f,%.5f\n", $col["GEOID"], $col["INTPTLAT"], $col["INTPTLONG"] }' \
  "$WORK"/*.txt > data/us-zcta.csv

echo "Wrote $(wc -l < data/us-zcta.csv) ZIP centres to data/us-zcta.csv"
