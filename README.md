# Beatmap

Self-serve territory and coverage mapping for sales and distribution teams in the US and UK.
Upload a spreadsheet of customers, dealers or stores, get every row on a map, and (coming next)
find coverage gaps and share a report. Product spec: [PRD.md](PRD.md).

## What works today

- Sign in with an emailed link (Supabase Auth); create a workspace (US or UK default).
- Upload CSV or Excel (.xlsx), with columns mapped automatically and editable.
- Every row is placed on the map using the cheapest source that works:
  1. latitude/longitude already in the sheet
  2. **US:** street address via the [US Census geocoder](https://geocoding.geo.census.gov/geocoder/) (free), then the ZIP code centre (Census Gazetteer, bundled)
  3. **UK:** postcode via [postcodes.io](https://postcodes.io) (free, ONS/OS open data), then the outward-code centre
- Map with clustering and confidence colours on free [OpenFreeMap](https://openfreemap.org) tiles, plus a list of rows that need attention.

No paid map or geocoding API is used, so there is no per-row cost.

## Stack

Next.js 16 (App Router) · Supabase (Postgres, Auth, row-level security) · MapLibre GL · Vitest.

## Setup

1. Create a Supabase project. Pick a region near your customers (US East or London).
2. Apply the schema: `supabase db push`, or run `supabase/migrations/*.sql` in order in the SQL editor.
3. In Supabase → Authentication → URL Configuration, set the Site URL to where the app runs and add
   `<that URL>/auth/confirm` to the redirect URLs (e.g. `http://localhost:3000/auth/confirm`).
4. Copy `.env.example` to `.env.local` and fill in the project URL and publishable key.
5. Run `npm install` and then `npm run dev`.

US ZIP code centres ship with the app in `data/us-zcta.csv`; `scripts/build-zcta.sh` rebuilds the file from the Census Gazetteer.

## Checks

```bash
npm test            # unit tests (import, column mapping, geocoding cascade)
npm run typecheck
npm run lint
npm run test:db     # migrations + row-level security tests; needs a local Postgres (PGHOST/PGPORT/PGUSER)
```

`sample-data/dealers-sample.csv` is a small mixed US/UK file for trying the upload flow.
