#!/usr/bin/env bash
# Loads US ZIP code (ZCTA) centroids from the Census Gazetteer (public domain) into ref_us_zcta.
# These are the fallback location for US rows whose street address can't be matched.
#
#   DATABASE_URL=postgresql://... scripts/load-zcta.sh
set -euo pipefail

YEAR="${ZCTA_YEAR:-2024}"
URL="https://www2.census.gov/geo/docs/maps-data/data/gazetteer/${YEAR}_Gazetteer/${YEAR}_Gaz_zcta_national.zip"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

curl -sSfL "$URL" -o "$WORK/zcta.zip"
unzip -q -o "$WORK/zcta.zip" -d "$WORK"
SRC="$(ls "$WORK"/*.txt | head -1)"

# The Gazetteer is tab-separated: GEOID, ALAND, AWATER, ALAND_SQMI, AWATER_SQMI, INTPTLAT, INTPTLONG.
# Pick columns by header name, since the column set has changed between years.
awk -F'\t' 'NR == 1 { for (i = 1; i <= NF; i++) { gsub(/ /, "", $i); col[$i] = i }; next }
            { gsub(/ /, "", $col["INTPTLONG"]); print $col["GEOID"] "," $col["INTPTLAT"] "," $col["INTPTLONG"] }' \
  "$SRC" > "$WORK/zcta.csv"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q <<SQL
begin;
create temp table zcta_load (zip text, lat double precision, lng double precision);
\copy zcta_load from '$WORK/zcta.csv' with (format csv)
insert into public.ref_us_zcta (zip, lat, lng)
select zip, lat, lng from zcta_load
on conflict (zip) do update set lat = excluded.lat, lng = excluded.lng;
commit;
SQL

echo "Loaded $(wc -l < "$WORK/zcta.csv") ZIP centroids."
