# PRD: Beatmap: self-serve territory and coverage planning on your own data

*Working name. Alternatives are in §1.1.*

| | |
|---|---|
| **Status** | Draft v0.1, for validation |
| **Date** | 2026-10-17 |
| **Author** | Jithu Jobin Sam (with Claude Code) |
| **Price anchor** | $50/month (about ₹4,200) self-serve plan |
| **Map/API constraint** | Google Maps Platform and open-source components only. No Mappls/MapmyIndia APIs or data. |

### How to read this document

Every claim is tagged with one of three labels:

- **[Fact]**: found in a public source, cited inline with its URL, or taken from the mGIS brochure the author wrote ("MapmyIndia mGIS, Spatial Analytics platform", dated 2021-07-29, marked "not permissible for general circulation"; cited as *[mGIS brochure]*).
- **[Assumption]**: a hypothesis that still needs validation. Each one names its validation method.
- **[Rec]**: a recommendation from the analysis.

Prices marked "Not publicly available" were not invented. §12 lists how to get them.

---

## 1. Executive summary

### 1.1 Product name suggestions

| Name | Why | Risk |
|---|---|---|
| **Beatmap** (recommended) | "Beat" is the everyday Indian FMCG/distribution word for a sales route or territory, so the name speaks the buyer's language | Needs a trademark and domain check |
| GeoSheets | Says exactly what it is: spreadsheets on a map | Generic, and likely taken in some form |
| Territo | Short and global | Says less about the job |
| PinPlan | Pincode plus planning, which fits India | Narrow if you expand to drive-time or global |

### 1.2 One-line positioning

**"Upload your dealer or customer sheet, and in 10 minutes see which pincodes you cover, which you are missing, and who should own them. No GIS analyst, no enterprise contract."**

### 1.3 Problem statement

Indian sales and distribution teams run territories from Excel, WhatsApp and memory. They already have the data: dealer lists, customer addresses with pincodes, sales by outlet, rep assignments. What they lack is a cheap way to answer spatial questions such as:

- Where are we not covered?
- Which dealers overlap?
- Which rep should own this new lead?
- Which district should we open next?

Today the options are:

1. **Enterprise GIS** (Esri, full mGIS deployments, GEOIQ). Powerful, but sold through sales calls and quotes, priced per user or per contract, and built for GIS-literate users.
   - [Fact] Esri Business Analyst Web is about $1,100 per user per year at entry level, per G2 (third-party) (https://g2.com/products/arcgis-business-analyst/pricing).
   - [Fact] ArcGIS Online user-type prices are behind "talk to sales" (https://www.esri.com/en-us/arcgis/products/arcgis-online/pricing).
   - [Fact] GEOIQ pricing is "contact for pricing" (https://www.g2.com/products/geoiq/pricing).
2. **Generic "spreadsheet on a map" tools** (Maptive, eSpatial, Mapline). Built for the US, priced in USD, with weak India pincode and district coverage.
   - [Fact] eSpatial lists $1,495/yr for Map Maker and $7,995/yr for Territory Map Maker (via G2 and aggregators, https://www.g2.com/compare/maptive-vs-espatial).
3. **Consultants and agencies.** One-off and slow, and the output is a static PDF that goes stale.

### 1.4 Proposed solution

A template-driven web app that does three jobs and nothing else:

1. **Map your data.** Upload a CSV, Excel file or Google Sheet. Columns are auto-mapped, addresses are cleaned and batch-geocoded, and the data is plotted on a map.
2. **Analyse coverage and territories.** Coverage-gap scoring by pincode or district, overlapping territories, unassigned demand, rep/dealer allocation, and simple drive-time catchments.
3. **Produce a decision-ready report.** A shareable live link plus a branded PDF with ranked "open here / reassign this / fix this" actions.

### 1.5 Why now

- [Fact] Google Maps Platform has India-specific pricing: up to 70,000 free calls per SKU per month on Essentials, Geocoding (India) at $1.50 per 1,000 after that, and billing in INR (https://developers.google.com/maps/billing-and-pricing/pricing-india, https://mapsplatform.google.com/intl/en_in/pricing/). That makes a $50 product's API costs workable.
- [Fact] Open India pincode boundary GeoJSON is published by the Department of Posts on data.gov.in (https://data.gov.in/resource/delivery-post-office-pincode-boundary). Its AIKosh mirror lists the licence as Open Government License, India (https://aikosh.indiaai.gov.in/home/datasets/details/all_india_pincode_boundary_geo_json.html). Pincode boundaries were historically a paid moat.
- [Fact] The incumbent is already moving downmarket. ClarityX sells mGIS as a self-serve product with a one-month free Starter and a Pro plan, but shows no public price (https://clarityx.ai/mgis/). That validates demand for self-serve, and leaves room for a transparent price and a simpler, template-first workflow.
- [Assumption] Mid-market Indian companies are digitising sales ops (DMS/SFA rollouts) but still lack spatial planning. Validate with 20 interviews (§12).

### 1.6 Primary ICP

**[Rec]** Indian mid-market brands that sell through dealers or distributors, with 50–2,000 dealers/retailers and 5–100 field reps. Example sectors: consumer durables, building materials (paints, tiles, pipes, cement), agri-inputs, two-wheeler/auto parts, FMCG regional brands, pharma distribution.

- **Economic buyer:** Head of Sales Ops, Distribution, or Channel.
- **Daily user:** a sales-ops analyst or MIS executive who lives in Excel.

### 1.7 Core value proposition

| Before | After |
|---|---|
| Two days of VLOOKUPs and a hand-coloured PowerPoint map | A pincode coverage map in under 10 minutes |
| "I think we're weak in north Karnataka" | "34 pincodes with more than 50k population and no dealer within 25 km, ranked" |
| ₹5–10 lakh GIS project, or a ₹1 lakh+ consultant | $50/month, self-serve, cancel anytime |
| A static map that goes stale | A live link that refreshes when the Google Sheet changes |

---

## 2. Market and user research

### 2.1 Competitor comparison

| Dimension | **Mappls / MapmyIndia mGIS** | **ClarityX mGIS** | **GEOIQ** | **Esri ArcGIS Online + Business Analyst** | **Beatmap (proposed)** |
|---|---|---|---|---|---|
| Positioning | "Do more with the power of spatial data analysis"; web GIS combining maps, GIS data and AI [Fact] (https://about.mappls.com/mgis/) | "Visualize Data. Uncover Insights. Drive Confident Action."; a "MAPPLS MapmyIndia Product" sold self-serve [Fact] (https://clarityx.ai/mgis/) | Location intelligence platform: retail expansion and site selection (RetailIQ), Explorer, No-Code ML, Data API [Fact, third-party] (https://www.techloy.com/indian-location-intelligence-startup-geoiq-raises-2-25-million.md) | Full enterprise GIS plus demographic location analytics | Territory and coverage planning on your own data |
| Target customer | Enterprises and government; "Enterprise Enabled" roles and access; cloud or on-prem [Fact] (https://about.mappls.com/mgis/) | Business analysts; Enterprise tier for custom needs [Fact] (https://clarityx.ai/mgis/) | Consumer brands expanding retail. Reported clients include Lenskart, BigBasket, Swiggy and Cult.fit [Fact, third-party] (https://www.techloy.com/indian-location-intelligence-startup-geoiq-raises-2-25-million.md) | GIS teams, large enterprises, government | Sales ops and distribution teams at Indian mid-market companies |
| Data upload | GeoJSON, KML, Shape, CSV, XLS, XLSX [Fact] *[mGIS brochure]* | "Bring Your Own Data", CRUD, field calculator (Pro), spatial/attribute merge (Pro) [Fact] (https://clarityx.ai/mgis/) | Mostly GEOIQ's own data (claims 600+ sources); customer data via API [Fact, third-party] | Every GIS format | CSV, XLSX, Google Sheets (P0). GeoJSON/KML (P2) |
| Geocoding | Batch geocoding and reverse geocoding on MapmyIndia APIs, plus Microsoft plugins [Fact] *[mGIS brochure]* | Not stated on the plans page | Address APIs for India [Fact, third-party] | Batch geocoding consumes credits | Batch geocode cascade with a confidence score and a fix-it queue |
| Visualisation | Clustering, density, heat map, thematic map, bubble map, category, gradient, pie and bar charts [Fact] *[mGIS brochure]* | Heatmaps, bubble charts, basemaps, themed workviews; pincode-level visualisation on Pro [Fact] (https://clarityx.ai/mgis/) | Dashboards and scores (details Not publicly available) | Extensive | Points, clusters, heatmap, category, bubble, choropleth by pincode or district |
| Boundaries | Preloaded India admin boundaries (state, district, sub-district, village, pincode, city); boundaries cannot be downloaded [Fact] *[mGIS brochure]* | State and district on all plans; pincode overlays on Pro [Fact] (https://clarityx.ai/mgis/) | Proprietary grid and pincode data (details Not publicly available) | Global admin boundaries | Open data: state, district and pincode (data.gov.in, OGL India) |
| Analytics | Gap/coverage, performance, catchment, road distance, custom boundary drawing, spatial and non-spatial queries [Fact] *[mGIS brochure]* | Cluster analysis, pocket creation, catchment analysis, search and routing [Fact] (https://clarityx.ai/mgis/) | ML site scoring and predictive models [Fact, third-party] | Drive time, territory design and suitability (Advanced bundle) [Fact, third-party] (https://aws.amazon.com/marketplace/pp/B0B1JTPQTT) | Template analyses only: coverage gap, overlap, assignment, drive-time |
| Third-party data layers | Affluence, POI, demographics, land use, transport, imagery [Fact] (https://about.mappls.com/mgis/) *[mGIS brochure]* | District CPI on all plans; pincode demographic, affluence, POI, traffic and search-preference data on Pro [Fact] (https://clarityx.ai/mgis/) | Core product (600+ sources) | Esri demographics (US-strong) | **None proprietary.** Open population grid (GHSL/WorldPop) and OSM POI counts only [Rec] |
| Saved work and sharing | Workviews; export to PDF/PNG/JPG [Fact] *[mGIS brochure]* | Multiple shareable workviews (Pro) [Fact] (https://clarityx.ai/mgis/) | Not publicly available | Web maps, dashboards, StoryMaps | Live share link plus branded PDF report |
| Pricing | Not publicly available ("Try for free" goes to login) (https://about.mappls.com/mgis/) | Starter: 200 MB, 1 user, one month free. Pro: 2 GB, up to 5 users, one-year access. Enterprise: custom. **No prices shown** [Fact] (https://clarityx.ai/mgis/) | Contact sales [Fact] (https://www.g2.com/products/geoiq/pricing) | BA Web about $1,100 per user per year entry (third-party) (https://g2.com/products/arcgis-business-analyst/pricing). AGOL user types: contact sales (https://www.esri.com/en-us/arcgis/products/arcgis-online/pricing) | Free / $50 / $150 per month, published |
| Sales motion | Enterprise sales plus trial | Self-serve trial, then Pro upgrade in-app; Enterprise via contact [Fact] (https://clarityx.ai/mgis/) | Enterprise sales | Sales, partners and web store | Self-serve plus founder-led outbound |
| Strengths | Best India map data; full GIS; on-prem option | Self-serve on mGIS depth; India data layers | Proprietary data and ML; strong retail logos | Unmatched depth and ecosystem | Simple, fast, transparent price, built around templates |
| Weaknesses / gaps for SMB | Feature-dense UI (dozens of tools in the brochure's UI map); enterprise buying motion | No public price; "a GIS tool" rather than "a territory answer"; time-boxed access | Opaque pricing; data-led rather than your-data-led | Cost, complexity, GIS literacy; US-centric data | No proprietary data; weaker geocoding than Mappls in rural India |

#### UX patterns worth copying

- **mGIS:** the welcome screen offers "guided tour / how-to videos / use-case examples". The "workview" concept of saving the exact analysis state is also good. *[mGIS brochure]*
- **ClarityX:** a trial that converts to an in-app upgrade.
- **Esri:** the analysis output becomes a shareable dashboard.

#### UX patterns to avoid

- A blank map plus a toolbar of 20+ tools as the first screen. The brochure's UI shows data management, charts, text, draw tools, main tools, batch operations, share/export and layer management all at once. That is the right design for a GIS analyst and the wrong one for a sales-ops executive.
- Layer-centric thinking: "add layer, style layer, query layer". Beatmap should be question-centric instead: "Where am I not covered?"

#### Why a small B2B team stalls on the incumbents [Assumption, validate in interviews]

1. They can't see the price without a call.
2. The first screen asks GIS questions (layers, projections, styling).
3. The proprietary data layers are what drives the price, and the team doesn't need them for the first question.
4. Procurement or security review for an annual contract.
5. No one owns "the GIS tool" internally.

### 2.2 Positioning map: ease of use against GIS depth

```
GIS depth ▲
 high     │  Esri ArcGIS / BA          Mappls mGIS (enterprise)
          │                 GEOIQ
          │                        ClarityX mGIS (self-serve)
          │
 medium   │              eSpatial (territories)
          │                                    ★ Beatmap (narrow depth,
          │        Maptive / Mapline              India boundaries, templates)
 low      │  Excel / Google My Maps
          └──────────────────────────────────────────────────────▶ Ease of use
             hard                                            easy
```

[Rec] Beatmap stays deliberately in the bottom-right. It is the easiest product that still answers the territory question with India pincode precision. It does not compete on depth.

### 2.3 Personas

| | **P1: Priya, Sales Ops / MIS Analyst** (primary user) | **P2: Rajesh, Head of Distribution / Channel Sales** (economic buyer) | **P3: Anita, Founder / CEO, SMB brand** (buyer-user) |
|---|---|---|---|
| Company | Paints brand, ₹300 Cr revenue, 1,200 dealers | Same | D2C plus retail brand, ₹40 Cr revenue, 150 distributors |
| Goals | Produce the monthly coverage review for the regional heads without spending two days on it | Grow numeric distribution; decide where to appoint new dealers; settle territory fights | Choose the next two states and set up distributors there |
| Pains | Excel can't do "within 25 km"; maps are made in PowerPoint; addresses are messy | No single view; every regional head says their region is under-served | Can't afford Esri or consultants; doesn't know what GIS is |
| Current workflow | DMS export → Excel pivot by pincode → manual colouring | Reads Priya's deck; asks for "a map" before board meetings | Google My Maps with 2,000-row limits; gut feel |
| Buying triggers | New annual sales plan; new region head; DMS rollout; board asks "where are we under-penetrated?" | Annual dealer-expansion target; territory dispute; new product launch | Fundraise deck; new-state launch |
| Budget authority | No; can expense under about ₹5k/month | Yes, ₹50k–5 lakh/yr | Yes, on a card |

### 2.4 Jobs to be done

1. **Primary:** "When I plan next quarter's dealer expansion, help me see which pincodes or districts with real demand have no dealer near them, so I can give my regional heads a ranked list of where to appoint."
2. "When two dealers or reps fight over an area, help me show the overlap objectively, so I can redraw the boundary and move on."
3. "When a new lead or outlet comes in, tell me which territory and rep it belongs to, so assignment is instant and fair."
4. "When my boss asks for a map, help me produce a clean, branded one in minutes, so I look competent and save a weekend."

### 2.5 Willingness-to-pay hypothesis

- **[Assumption]** P1 will expense ₹4,200/month ($50) without procurement if it saves 1–2 days a month of analyst time. The analyst's fully-loaded cost is ₹40–80k/month, so 1–2 days is ₹2–7k. Validate with a pricing test: Van Westendorp in interviews plus a live checkout A/B at $39/$50/$79.
- **[Assumption]** P2 will pay ₹1–2 lakh/yr ($150/month team plan, or annual) once the output appears in a leadership review.
- **[Fact, competitive anchor]** US self-serve mapping sits at about $110–125/month per user: eSpatial $1,495/yr (https://www.g2.com/compare/maptive-vs-espatial), Maptive about $110/month+ (multiple conflicting sources: https://www.maptive.com/best-sales-mapping-software/). $50 undercuts them clearly, and in India it sits below most enterprise GIS quotes. mGIS and GEOIQ prices are Not publicly available.

### 2.6 Key objections and answers

| Objection | Answer |
|---|---|
| "Google Maps is free, why pay?" | Google Maps won't tell you which pincodes are uncovered, can't score 1,200 dealers, and can't produce a report. We use Google's map; we sell the answer. |
| "MapmyIndia knows India addresses better." | True for the hardest rural addresses. That's why every row shows a confidence score and a one-click fix. Most dealer lists already contain pincodes, and pincode-level analysis doesn't need rooftop precision. |
| "Is our dealer data safe?" | India-region hosting, encryption, no data resale, and delete-on-cancel. The data is only used to serve your workspace. |
| "We don't have a GIS person." | You don't need one. Pick a template, upload a sheet, read the answer. |
| "We'll need it in our CRM/DMS." | CSV and Google Sheets in and out from day 1; CRM connectors on the roadmap (§11). |
| "No demographic data like GEOIQ or mGIS?" | v1 uses open population estimates to rank gaps, which is enough to prioritise. If you need affluence or footfall data, you're the enterprise buyer, and those tools are the right ones. |

---

## 3. Product strategy

### 3.1 Primary wedge: dealer/distributor coverage and territory planning

| Candidate wedge | Demand (India mid-market) | Ease of adoption (data they already have) | WTP | Outbound reachability | Verdict |
|---|---|---|---|---|---|
| **Dealer/distributor network coverage and territory planning** | High: distribution-led growth is the core strategy in durables, building materials and agri [Assumption] | **High**: every brand has a dealer master with pincodes | Medium-high: tied to revenue expansion | **High**: "Head of Distribution/Channel" is a clear LinkedIn title | ✅ **Primary** |
| Sales territory and coverage gap (direct B2B sales) | Medium | High | Medium | High | Merge into the primary wedge (same engine) |
| Retail catchment and site selection | High, but GEOIQ's home turf | Low: needs footfall and affluence data we don't have | High | Medium | ❌ v1 (data moat belongs to the incumbents) |
| Logistics serviceability and delivery zones | Medium | Medium | Medium | Medium | P2 template later |
| Field-sales/service territory optimisation (route balancing) | Medium | Medium | Medium | Medium | P2: optimisation is a hard engineering problem |
| Lead-to-territory assignment | Medium | High | Low as a standalone product | Medium | ✅ as a **feature** of the primary wedge |

**[Rec] Why dealer coverage wins:**

1. The input data already exists and is clean enough: dealer master plus pincode plus sales.
2. The output fits an existing ritual: the quarterly or annual distribution review.
3. Pincode-level analysis tolerates imperfect geocoding.
4. It doesn't depend on proprietary demographic data, which is where mGIS and GEOIQ are strongest.
5. A free "coverage audit" is a natural outbound hook (§9.5).

### 3.2 V1 scope: the three jobs only

1. **Map my data**: import, clean, geocode, visualise.
2. **Coverage and territories**: gap scoring, overlap, assignment, drive-time rings.
3. **Report**: share link plus PDF with ranked actions.

### 3.3 Explicit non-goals for v1

- ❌ Navigation, routing UI, turn-by-turn, live tracking.
- ❌ A general GIS editor: arbitrary layer styling, projections, raster analysis, Shapefile editing.
- ❌ Proprietary demographic, affluence or footfall data.
- ❌ Route optimisation, beat planning or daily visit scheduling.
- ❌ Mobile app for field reps (reports are mobile-friendly; the app is desktop-first).
- ❌ On-prem deployment.
- ❌ Any Mappls/MapmyIndia API, data or derived content.
- ❌ 3D, imagery, AI image analysis.

### 3.4 Differentiation

| vs | Beatmap's difference |
|---|---|
| **Mappls mGIS / ClarityX mGIS** | Question-first templates instead of a layer-first GIS; published price; your data plus open data only; built for one persona (sales ops), not for "anyone with spatial data" |
| **GEOIQ** | Your data, not theirs; answers network coverage rather than site scoring; self-serve in minutes rather than an enterprise engagement |
| **Esri** | About a tenth of the price; no GIS literacy needed; India pincode and district boundaries built in |
| **Maptive / eSpatial** | India-first (pincodes, districts, INR billing, Google India pricing); report generation; cheaper |

### 3.5 Why template-driven rather than a general GIS tool

1. **Time to value.** The user's question is "where am I uncovered?", not "how do I build a buffer". A template gets from upload to answer without the user having to learn GIS.
2. **Metering and cost control.** Templates have known API costs (geocodes, drive-times). Free-form GIS doesn't.
3. **Differentiation.** Copying a general GIS means competing on depth, where Esri and mGIS win.
4. **GTM.** Each template is a landing page, an outbound hook and a demo ("Dealer Coverage Audit", "Territory Overlap Check").
5. **Support load.** A small set of known workflows is supportable by a two-person team.

**v1 templates:**

- **T1 Dealer Coverage Gap** (P0)
- **T2 Territory Overlap and Balance** (P0)
- **T3 Lead/Outlet → Territory Assignment** (P1)
- **T4 Drive-time Serviceability** (P1)

### 3.6 Pricing recommendation [Rec, validate in §12]

| | **Free** | **Starter, $50/mo** (₹4,200; annual $500) | **Team, $150/mo** (₹12,500; annual $1,500) | **Enterprise** |
|---|---|---|---|---|
| Users (editors) | 1 | 3 | 10 | Custom |
| Viewers on share links | Public link only | Unlimited | Unlimited | SSO |
| Rows stored (total) | 500 | 10,000 | 50,000 | Custom |
| New geocodes / month | 250 | 5,000 | 25,000 | Custom / BYO Google key |
| Active maps (projects) | 1 | 10 | 50 | Custom |
| Drive-time catchments / month | 5 | 200 | 1,000 | Custom |
| PDF reports / month | 2 (watermarked) | 30 | 150 | Unlimited |
| Templates | T1 only | All | All, plus custom scoring weights | Custom templates |
| Google Sheets live sync | ❌ | ✅ (daily) | ✅ (hourly) | ✅ |
| Branded reports (logo) | ❌ | ✅ | ✅ | White-label |
| Exports (CSV/GeoJSON) | CSV only | ✅ | ✅ | ✅ + API |
| Support | Docs | Email | Priority + onboarding call | SLA, DPA |
| Data retention after cancel | 30 days | 30 days | 30 days | Contract |

**Add-ons:** +5,000 geocodes for $10; +10,000 rows for $10.

### 3.7 Usage metering and unit economics

| Meter | Cost driver | Estimated cost to us | Starter allowance | Max COGS at the Starter cap |
|---|---|---|---|---|
| Geocodes | Google Geocoding (India) $1.50/1k after 70k free/month per billing account [Fact] (https://developers.google.com/maps/billing-and-pricing/pricing-india) | $0.0015/geocode | 5,000 | $7.50 |
| Map loads | Google Dynamic Maps (India) $2.10/1k after 70k free [Fact] (same URL) | $0.0021/load | Not metered; fair use about 1,500 | $3.15 |
| Drive-time | Self-hosted Valhalla/OSRM on OSM (fixed infra) [Rec] | about $0 marginal | 200 | ~$0 |
| Rows and storage | Postgres/PostGIS | <$0.50 | 10k rows | $0.50 |
| PDF rendering | Headless Chromium worker | <$0.20 | 30 | $0.20 |
| Payments | Razorpay/Stripe about 2–3% | | | $1.50 |
| **Total worst case** | | | | **≈ $13 → about 74% gross margin at the cap; typical use about 85–90%** [Assumption] |

**Protecting margin:**

- Geocodes are the only variable cost that matters. They are metered as **new unique addresses**. Re-uploads that hit the cache are free to the user, which works as a retention hook.
- The first 70k free Google calls/month are pooled across all customers, so the first 50–100 customers' geocodes are largely free.
- Enterprise and power users can bring their own Google API key.

---

## 4. User flows

### 4.1 New user onboarding

1. Land on a template page (e.g., "Dealer Coverage Audit") → **Start free** (Google sign-in or email OTP).
2. Enter workspace name, company and industry (dropdown), and "What do you want to answer?" (choose a template).
3. Choose a starting point: **Upload my sheet** / **Connect Google Sheet** / **Try sample data** (a paints-brand demo with 800 dealers).
4. → Import flow (4.2).
5. Success is the first map rendered with the template's headline insight. Target: under 10 minutes.

### 4.2 CSV / Excel / Google Sheets upload

1. Drag in a file (.csv, .xlsx, up to 20 MB) or paste a Google Sheet URL (OAuth with read-only Sheets scope).
2. Pick the sheet or tab; header-row detection; preview of the first 20 rows.
3. **Column mapping.** Auto-suggest roles: `Name`, `Address line`, `City`, `District`, `State`, `Pincode`, `Latitude`, `Longitude`, `Category` (dealer/distributor/retailer), `Owner/Rep`, `Territory`, `Metric` (sales, volume). The user confirms or overrides. Mappings are remembered per workspace.
4. Validation summary, for example: "1,182 rows · 1,140 with pincode · 46 duplicate names · 12 invalid pincodes". Choose **Fix later** or **Fix now**.
5. → Geocoding (4.3).

### 4.3 Address cleaning and batch geocoding

1. Normalise each row: trim, expand abbreviations ("Rd", "Ngr", "Opp."), validate the 6-digit pincode against the master list, and check that state and district match the pincode.
2. **Cascade per row** (cheapest first):
   - a. Valid lat/lng present and inside India → use it (confidence **High**).
   - b. Exact match in the workspace cache (normalised address hash) → reuse.
   - c. Google Geocoding with region `in` and a component filter on the pincode → confidence from `location_type` (ROOFTOP/RANGE_INTERPOLATED = High, GEOMETRIC_CENTER = Medium, APPROXIMATE = Low). Reject the result if it falls outside the row's pincode polygon.
   - d. Fallback: pincode polygon centroid (confidence **Pincode-level**).
   - e. Otherwise the row is **Failed**.
3. Job runs in the background with a progress bar. The user can explore the map while rows stream in.
4. Result card, for example: "1,096 geocoded (High 71%, Medium 14%, Pincode-level 12%), 44 failed."
5. **Fix-it queue:** the failed and low-confidence rows. Fix each by editing the address, dragging the pin, or "use pincode centroid". Bulk-accept is available.

### 4.4 Map visualisation

1. The default view depends on the template (T1: points coloured by category plus a pincode choropleth).
2. Right panel: **Layers** (your data, boundaries, population), **Style** (points / clusters / heatmap / bubble by metric / category colours), **Filter** (by category, rep, state, metric range).
3. Click a point to see its record card; click a pincode to see stats (dealers, sales, population, nearest dealer distance).
4. **Save view** stores filter, style and extent (like an mGIS workview).

### 4.5 Coverage-gap and territory analysis

**T1 Dealer Coverage Gap:**

1. Set the service radius (default 15 km straight-line; or drive-time in minutes, P1) and the boundary level (pincode / district).
2. Choose the demand proxy: population (default) / your sales metric / custom column.
3. Run. Each pincode/district gets a status (**Covered / Thin / Uncovered**) and a **Gap Score** (0–100).
4. Output: choropleth, a ranked table of the top-N gaps, and a summary ("Uncovered population: 4.2 Cr across 612 pincodes; top 20 listed").

**T2 Territory Overlap and Balance:**

1. Territories come from a `Territory` column (a list of pincodes), a sales-rep column, or by drawing polygons.
2. Run. Overlapping pincodes are flagged; unassigned pincodes are flagged; a per-territory balance table shows dealers, sales, population and area, with a variance from the mean.
3. Reassign by selecting pincodes and choosing **Move to territory X**. The balance table updates live.

### 4.6 Report generation and sharing

1. **Create report** → choose sections (summary KPIs, map snapshot(s), top gaps table, overlap table, recommended actions, methodology note).
2. Auto-written "Recommended actions" (rule-based in v1), for example: "Appoint a dealer in pincode 586101 (Bijapur): 1.2 lakh population, nearest dealer 48 km."
3. Branding: logo, colour, title.
4. Outputs: **share link** (view-only, optional password and expiry), **PDF**, **CSV/GeoJSON** of the analysis table.

### 4.7 Upgrade path, free to paid

**Upgrade triggers** (always shown in context, never a dead-end):

- More than 500 rows: "Your sheet has 1,182 rows. Free maps the first 500. Upgrade to map all."
- Geocode cap reached.
- A second map.
- Removing the PDF watermark.
- Templates T2–T4.
- Inviting a teammate.

**Checkout:** Razorpay (INR, UPI, cards; GST invoice) for India and Stripe for international. Annual saves about 17%. Limits are unlocked immediately with no data loss.

---

## 5. Functional requirements

**Priority key:**

- **P0**: required to launch.
- **P1**: within 90 days of launch.
- **P2**: later.

### 5.1 Authentication and workspace

| ID | Pri | User story | Acceptance criteria |
|---|---|---|---|
| A1 | P0 | As a new user, I want to sign up with Google or email OTP, so that I can start in under a minute. | Google OAuth and email OTP work; no password required; a workspace is created on first login; time from landing to workspace is under 60 seconds. |
| A2 | P0 | As a workspace owner, I want to invite teammates by email with a role, so that my team can collaborate. | Roles: Owner, Editor, Viewer; invites expire in 7 days; the seat cap per plan is enforced with an upgrade prompt. |
| A3 | P1 | As an admin, I want to restrict sign-in to my company domain, so that ex-employees can't get access. | Domain allow-list; members removed by the owner lose access immediately. |
| A4 | P2 | As an enterprise IT admin, I want SAML SSO, so that access follows our IdP. | SAML 2.0 with Google Workspace, Azure AD and Okta. |

### 5.2 Data import and validation

| ID | Pri | User story | Acceptance criteria |
|---|---|---|---|
| D1 | P0 | As an analyst, I want to upload CSV/XLSX up to 20 MB, so that I can use my existing exports. | Handles UTF-8 and UTF-16, Excel dates, multiple sheets (picker), and up to 50k rows; parse errors shown with row numbers. |
| D2 | P0 | As an analyst, I want to see a validation summary before processing, so that I know data quality up front. | Shows total rows, rows missing an address and pincode, invalid pincodes (not in the master list), duplicates, and a pincode/state mismatch count. |
| D3 | P1 | As an analyst, I want to connect a Google Sheet and refresh it, so that the map stays current without re-uploading. | Read-only OAuth scope; manual refresh plus scheduled refresh (daily on Starter, hourly on Team); only new or changed rows are geocoded. |
| D4 | P2 | As an analyst, I want to upload GeoJSON/KML territories, so that I can reuse existing boundaries. | Polygons are validated and reprojected to EPSG:4326. |

### 5.3 Column mapping

| ID | Pri | User story | Acceptance criteria |
|---|---|---|---|
| C1 | P0 | As an analyst, I want columns auto-mapped to roles, so that I don't configure manually. | Header heuristics in English, plus common Hindi transliterations (e.g., "pin", "pin code", "PINCODE", "zip"); at least 90% of headers in sample files are mapped correctly. |
| C2 | P0 | As an analyst, I want to override any mapping and choose a combined or split address, so that odd sheets still work. | Every role can be reassigned or left blank; at least one location role (lat/lng, address or pincode) is required. |
| C3 | P1 | As an analyst, I want my mapping remembered, so that monthly re-uploads are one click. | Saved per workspace, keyed by the header signature. |

### 5.4 Geocoding and failed-row handling

| ID | Pri | User story | Acceptance criteria |
|---|---|---|---|
| G1 | P0 | As an analyst, I want addresses batch-geocoded in the background, so that I can keep working. | Runs as a queued job; progress shown; 5,000 rows in under 5 minutes at p50; resumable after failure; idempotent. |
| G2 | P0 | As an analyst, I want a confidence label per row, so that I know what to trust. | Labels: High / Medium / Pincode-level / Failed, derived per §4.3; filterable on the map and in the table. |
| G3 | P0 | As an analyst, I want a fix-it queue for failed and low-confidence rows, so that I can correct them quickly. | Edit the address and re-geocode; drag the pin; use the pincode centroid; bulk-accept; every fix is logged. |
| G4 | P0 | As the business, I want geocodes cached and metered by unique normalised address, so that costs stay bounded. | Cache hits don't consume credits; usage is counted per workspace per month; a hard stop at the cap shows an upgrade or add-on CTA. |
| G5 | P0 | As the business, I want results that disagree with the pincode to be rejected, so that bad geocodes don't pollute the analysis. | A point outside the row's pincode polygon plus a 2 km tolerance is downgraded to Pincode-level, with the reason shown. |
| G6 | P1 | As an analyst, I want to export geocoded results, so that I can update my DMS. | CSV with lat, lng, confidence and the matched pincode/district. Subject to the provider terms check (§10, §12). |

### 5.5 Map rendering and layer controls

| ID | Pri | User story | Acceptance criteria |
|---|---|---|---|
| M1 | P0 | As a user, I want my points rendered smoothly on an India map, so that I can explore. | 50k points at 60 fps on a 2020 laptop (WebGL); pan and zoom; search places. |
| M2 | P0 | As a user, I want to toggle and filter layers, so that I can focus. | Toggle per layer; filter by category, rep, territory, confidence and metric range; legend updates. |
| M3 | P0 | As a user, I want to click any feature for details, so that I can inspect. | Popup shows the record fields; a pincode popup shows the aggregates. |
| M4 | P1 | As a user, I want to save a named view, so that I can return to it or share it. | Saves extent, layers, filters and styles. |

### 5.6 Visualisations

| ID | Pri | User story | Acceptance criteria |
|---|---|---|---|
| V1 | P0 | As a user, I want cluster and category views, so that dense networks are readable. | Auto-cluster below zoom 10; colour by any category column (up to 12 colours, then "Other"). |
| V2 | P0 | As a user, I want a choropleth by pincode/district for any metric, so that I can see the pattern. | Aggregations: count, sum, mean; quantile classes (5); accessible palette. |
| V3 | P1 | As a user, I want heatmaps and bubble maps, so that I can show intensity. | Heatmap weighted by metric; bubble size by metric with a legend. |

### 5.7 Boundary overlays

| ID | Pri | User story | Acceptance criteria |
|---|---|---|---|
| B1 | P0 | As a user, I want state, district and pincode boundaries built in, so that I don't hunt for shapefiles. | Open datasets (data.gov.in pincode GeoJSON; district boundaries from an open source with a verified licence) served as vector tiles; licence and vintage shown in the methodology note. |
| B2 | P0 | As a user, I want each point tagged with its state, district and pincode, so that I can aggregate. | Point-in-polygon on import; a mismatch with the user's pincode column is flagged. |
| B3 | P1 | As a user, I want population per pincode/district, so that I can rank demand. | Derived from an open population grid (GHSL or WorldPop) aggregated to polygons; labelled "estimate", with year and source. |

### 5.8 Territory creation and assignment

| ID | Pri | User story | Acceptance criteria |
|---|---|---|---|
| T1 | P0 | As a sales-ops analyst, I want territories built from a column of pincodes or reps, so that my existing plan appears instantly. | Group by the Territory/Rep column; each territory is the union of its pincode polygons; overlaps and unassigned pincodes are flagged. |
| T2 | P0 | As a sales-ops analyst, I want to reassign pincodes between territories with a lasso, so that I can redraw boundaries. | Multi-select pincodes; move to a territory; undo/redo; balance table updates in under 1 second. |
| T3 | P0 | As a head of distribution, I want a territory balance table, so that I can make allocation fair. | Per territory: dealers, sales, population, area and % deviation from the mean; sortable; exportable. |
| T4 | P1 | As an analyst, I want new leads/outlets auto-assigned to a territory and rep, so that routing is instant. | Assign by containing pincode, falling back to the nearest territory; output columns appended; available via CSV re-upload and Sheets sync. |
| T5 | P2 | As an analyst, I want auto-balanced territories proposed, so that I can start from an optimised draft. | Contiguous pincode partitioning against a target metric with tolerance (heuristic). |

### 5.9 Coverage-gap scoring

| ID | Pri | User story | Acceptance criteria |
|---|---|---|---|
| S1 | P0 | As a head of distribution, I want every pincode/district classified as Covered/Thin/Uncovered, so that I see gaps. | Coverage = nearest dealer distance against the radius R (default 15 km straight-line); Thin = between R and 2R or fewer than X dealers per lakh population; parameters editable. |
| S2 | P0 | As a head of distribution, I want a ranked Gap Score, so that I know where to act first. | Gap Score 0–100 = weighted blend of normalised demand proxy, distance to nearest dealer and (optional) the user's sales-per-capita in neighbouring pincodes. Weights are shown, and editable on Team. The formula is printed in the report. |
| S3 | P1 | As a user, I want to compare two runs (before/after reassignment), so that I can show impact. | Side-by-side KPIs and a diff map. |

### 5.10 Catchment / drive-time

| ID | Pri | User story | Acceptance criteria |
|---|---|---|---|
| R1 | P0 | As a user, I want radius rings around selected locations, so that I can see reach. | 1–3 radius rings per point; for up to 500 points at once. |
| R2 | P1 | As a user, I want drive-time catchments (10/20/30 min), so that reach reflects roads. | Isochrones from a self-hosted Valhalla on OSM India; metered; cached per point and parameters; labelled "estimated, OSM road network". |
| R3 | P2 | As a user, I want serviceability by drive time from depots, so that I can plan delivery zones. | Pincodes tagged with the minimum drive time from any depot. |

### 5.11 Report builder

| ID | Pri | User story | Acceptance criteria |
|---|---|---|---|
| P1r | P0 | As an analyst, I want a one-click report from a template run, so that I can send it to my boss. | Sections: title, KPIs, map snapshot, top-N gaps table, overlap/balance table, recommended actions, methodology and data sources; rendered in under 30 seconds. |
| P2r | P0 | As an analyst, I want rule-based recommended actions, so that the report says what to do. | At least 3 rules in v1: appoint (top uncovered), reassign (overlap), rebalance (over 30% deviation); each action cites the numbers behind it. |
| P3r | P1 | As an analyst, I want to edit the text and reorder sections, so that it matches our deck. | Inline editing; section toggles; logo and brand colour. |
| P4r | P2 | As an analyst, I want an AI-written executive summary, so that I save time. | Generated from the computed tables only; the user must accept it before export. |

### 5.12 Share, export

| ID | Pri | User story | Acceptance criteria |
|---|---|---|---|
| X1 | P0 | As an analyst, I want a view-only share link, so that leadership can open it on a phone. | Unguessable URL; optional password and expiry; can be revoked; mobile-responsive. |
| X2 | P0 | As an analyst, I want a PDF export, so that I can attach it to email or WhatsApp. | A4 landscape; vector tables; map at 2× DPI; under 10 MB; watermark on Free. |
| X3 | P0 | As an analyst, I want CSV export of analysis tables, so that I can continue in Excel. | Pincode table, territory table and gaps list. |
| X4 | P1 | As an analyst, I want GeoJSON export of territories, so that other tools can use them. | Valid RFC 7946. |

### 5.13 Team collaboration

| ID | Pri | User story | Acceptance criteria |
|---|---|---|---|
| K1 | P1 | As a team, we want comments pinned to a pincode or territory, so that we can discuss decisions. | Threaded comments, @mention with an email notification. |
| K2 | P1 | As an owner, I want an activity log, so that I know who changed territories. | Records who, what and when for imports, reassignments and exports. |

### 5.14 Billing, plan limits, usage tracking

| ID | Pri | User story | Acceptance criteria |
|---|---|---|---|
| L1 | P0 | As a buyer, I want to pay by UPI or card in INR with a GST invoice, so that I can expense it. | Razorpay subscriptions; GSTIN capture; invoices emailed; Stripe for non-INR. |
| L2 | P0 | As a user, I want to see my usage against limits, so that I'm not surprised. | Usage page: rows, geocodes, maps, reports, drive-times; alerts at 80% and 100%. |
| L3 | P0 | As the business, I want limits enforced server-side, so that costs can't run away. | Checked in the API and the job queue; soft prompt at the UI, hard stop at the server. |
| L4 | P1 | As a buyer, I want to buy add-on credits, so that I don't need to upgrade the plan. | One-off packs; applied instantly. |

### 5.15 Admin and data security

| ID | Pri | User story | Acceptance criteria |
|---|---|---|---|
| S-1 | P0 | As a customer, I want my data isolated from other companies, so that it stays private. | Row-level security on every tenant table; automated cross-tenant access tests in CI. |
| S-2 | P0 | As a customer, I want my data stored in India and encrypted, so that I meet internal policy. | Primary DB and storage in an India region (Mumbai); TLS 1.2+; encryption at rest. |
| S-3 | P0 | As a customer, I want to delete my workspace and all its data, so that I stay in control. | Self-serve delete; hard-deleted within 30 days, including backups on rotation; confirmation email. |
| S-4 | P1 | As an admin, I want audit logs and an export of all my data, so that I meet compliance requests. | Downloadable audit log; a full data export ZIP. |
| S-5 | P1 | As a customer, I want a DPA and a privacy notice aligned to the DPDP Act, so that legal approves us. | Published DPA; breach notification process; grievance officer contact. |

---

## 6. Technical requirements

### 6.1 Key constraint: Google Maps Platform terms shape the architecture

- [Fact] Google's Geocoding terms historically allow caching lat/lng for a limited period, commonly stated as 30 consecutive days, and require geocodes to be used with a Google map. **This could not be verified verbatim in this research pass** (https://cloud.google.com/maps-platform/terms/maps-service-terms). Treat it as a hard requirement until legal confirms (§12).
- **[Rec]** Consequences:
  1. Render on **Google Maps JS API** whenever Google-geocoded points are displayed. Use deck.gl's `GoogleMapsOverlay` for WebGL layers.
  2. Store Google **place IDs**. Google's terms have historically exempted place IDs from caching limits. Re-geocode coordinates older than the permitted window only when a map that needs them is opened. That cost is bounded by active rows.
  3. Keep everything derivable from **open data** (pincode/district membership, population, isochrones) independent of Google.
  4. Keep an **open-only mode** behind a flag: MapLibre plus OpenFreeMap/Protomaps OSM tiles, Photon/Nominatim self-hosted on India OSM, and pincode centroid fallback. This is the exit plan if Google costs or terms change.

[Fact] The public Nominatim service allows at most 1 request/second and discourages bulk geocoding, so it can't be the production geocoder (https://operations.osmfoundation.org/policies/nominatim/). Open geocoding must be self-hosted.

### 6.2 Architecture

```
 Browser (Next.js + deck.gl on Google Maps JS)
   │  HTTPS
   ▼
 API layer (Next.js route handlers / Supabase Edge Functions)
   │                         │
   ▼                         ▼
 Supabase (ap-south-1 Mumbai)            Job queue (pgmq in Postgres)
  • Postgres 17 + PostGIS                     │
  • Auth (Google, email OTP)                  ▼
  • Row-Level Security                  Worker service (Python/TS, Mumbai)
  • Storage (uploads, PDFs)               • parse/clean/geocode batches → Google Geocoding
  • pg_cron (Sheets sync, re-geocode)     • point-in-polygon, scoring (PostGIS)
                                          • isochrones → self-hosted Valhalla (OSM India)
                                          • PDF render → headless Chromium
 Static vector tiles (boundaries) on CDN: PMTiles built from data.gov.in / open sources
 Billing: Razorpay (INR) + Stripe (intl) webhooks → plan + usage tables
```

### 6.3 Stack recommendation [Rec]

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js (React, TypeScript), Tailwind, deck.gl + `@vis.gl/react-google-maps` | Fast to build; WebGL handles 50k+ points; Google overlay complies with the display terms |
| Backend/API | Next.js route handlers plus Supabase Edge Functions | One codebase; thin API |
| DB + geo | **Supabase Postgres with PostGIS**, in **ap-south-1 (Mumbai)** | Auth, RLS, Storage and queues in one; PostGIS does point-in-polygon, distances and unions. Note: the existing `Delecta` Supabase project is in ap-northeast-1 (Tokyo). Create a new Mumbai project for India residency. |
| Jobs | `pgmq` queue plus a long-running worker container (Fly.io/Render/Railway, Mumbai region) | Bulk geocoding and PDFs exceed edge-function time limits |
| Geocoding | Google Geocoding API (India pricing) → pincode-centroid fallback; optional self-hosted Photon for open-only mode | Best India address coverage among allowed options [Assumption: benchmark in a spike, §11] |
| Basemap | Google Maps JS (Dynamic Maps); open-only mode uses MapLibre + OSM tiles | Terms compliance (§6.1) |
| Routing / isochrones | **Valhalla** self-hosted on an OSM India extract (Geofabrik) | No per-call cost; isochrones built in |
| Boundaries | data.gov.in pincode GeoJSON (OGL India); state/district from an open source with a verified licence; served as PMTiles | No proprietary data; vintage displayed |
| Population | GHSL or WorldPop gridded population aggregated per pincode at build time | Open licences [Assumption: verify licence terms for commercial use] |
| PDF | Playwright/Chromium rendering a print route | Pixel-matches the web report |
| Billing | Razorpay Subscriptions plus Stripe Billing | UPI and GST for India |
| Observability | Sentry, PostHog (product analytics, India or EU hosting), uptime monitor | §8 metrics |

### 6.4 Caching strategy to reduce API cost

1. **Address cache.** Key = SHA-256 of the normalised address plus pincode. Scope:
   - Workspace scope for coordinates (keeps tenants isolated, and keeps Google content within the permitted use).
   - Global scope only for **open-data derivations** (pincode centroid, pincode validity).
2. **Incremental sync.** Only new or changed rows (row hash) are geocoded on re-upload or Sheets refresh.
3. **Isochrone cache.** Key = (rounded lat/lng to 4 dp, mode, minutes).
4. **Tile and boundary cache.** Static PMTiles on a CDN; zero runtime API cost.
5. **Map-load hygiene.** One Google map instance per session; no map on list-only pages; share links use a static map image for thumbnails (Static Maps is cheaper, $0.60/1k [Fact], https://developers.google.com/maps/billing-and-pricing/pricing-india).

### 6.5 Background jobs

- **Job types:** `import.parse`, `geocode.batch` (chunks of 100 rows), `analysis.run`, `isochrone.batch`, `report.render`, `sheets.sync`, `geocode.refresh`.
- **Execution:**
  - At-least-once delivery with idempotency keys.
  - Per-workspace concurrency limit (2) and a global Google QPS limiter (token bucket).
  - Exponential backoff on `OVER_QUERY_LIMIT`.
  - A dead-letter queue surfaces errors as "Failed" rows.
- **Progress:** progress is written to a `jobs` table; the UI subscribes via Supabase Realtime.
- **Metering:** a credit is debited when a job **enqueues**, not when it completes, and refunded on failure. This prevents overage races.

### 6.6 Multi-tenant data model (core tables)

```
workspaces(id, name, plan, region, created_at)
memberships(workspace_id, user_id, role)            -- owner | editor | viewer
datasets(id, workspace_id, name, source, header_signature, column_map jsonb, row_count)
records(id, workspace_id, dataset_id, row_hash, attrs jsonb,
        address_norm, pincode, geom geography(Point), geocode_conf, geocode_src,
        place_id, geocoded_at, pincode_id, district_id, state_id)
geocode_cache(workspace_id, addr_hash, place_id, geom, conf, geocoded_at)
territories(id, workspace_id, name, owner_label, geom geography(MultiPolygon))
territory_pincodes(territory_id, pincode_id)
analyses(id, workspace_id, template, params jsonb, status, results jsonb, created_at)
reports(id, workspace_id, analysis_id, config jsonb, pdf_path, share_token, expires_at, password_hash)
usage_events(workspace_id, meter, qty, period, created_at)
-- shared, read-only reference data (no workspace_id):
ref_pincodes(id, pincode, geom, district_id, state_id, population_est, source, vintage)
ref_districts(...), ref_states(...)
```

Every table with `workspace_id` has an RLS policy of the form `workspace_id IN (select workspace_id from memberships where user_id = auth.uid())`.

### 6.7 Role-based access control

| Action | Owner | Editor | Viewer | Share-link visitor |
|---|---|---|---|---|
| Billing, delete workspace, domain lock | ✅ | | | |
| Invite/remove members | ✅ | | | |
| Import, geocode, edit territories, run analyses | ✅ | ✅ | | |
| Create/revoke share links, export | ✅ | ✅ | | |
| View maps and reports | ✅ | ✅ | ✅ | the shared report only |

### 6.8 Security, privacy, India data residency

- **DPDP Act 2023.** Customer uploads may contain personal data (customer names, phone numbers, addresses).
  - Beatmap is a **data processor** for its customers.
  - Publish a DPA; minimise columns by letting users exclude PII columns at mapping time; set breach notification timelines; appoint a grievance officer.
  - Get a legal review (§12).
- **Residency.** All customer data and backups go in an India region. Geocoding requests send addresses to Google, so disclose Google as a sub-processor.
- **Controls.**
  - Secrets in a vault; least-privilege service keys (the Supabase service role is used only by the worker).
  - Signed URLs for files.
  - Share tokens of 128-bit randomness.
  - Rate limiting on auth and share endpoints.
  - Dependency scanning.
- **Not in v1:** SOC 2 and ISO 27001. Have a security questionnaire answer pack ready by the time of the Team tier.

### 6.9 Scalability risks and mitigation

| Risk | Mitigation |
|---|---|
| A 50k-row geocode spikes Google QPS | Global token bucket, chunking, queueing; tell users the ETA up front |
| Rendering 50k points plus pincode polygons (about 19k pincodes nationally) | Vector tiles for boundaries; deck.gl binary attributes; server-side aggregation for choropleths |
| PostGIS spatial joins over 50k × 19k | GiST indexes; pre-computed pincode membership at import |
| Valhalla memory on the all-India graph | Size the worker for the India extract; cache isochrones; a P1 feature can ship on a single instance |
| Noisy tenants | Per-workspace job concurrency; plan caps |

---

## 7. UX requirements

### 7.1 Guided wizard

The wizard has five steps, shown as a persistent left stepper:

1. **Upload** → 2. **Check columns** → 3. **Locate** (geocode) → 4. **Analyse** (template params) → 5. **Report**

Rules:

- Each step has one primary button.
- Advanced options are collapsed.
- Every step shows "what this will cost you" in credits.

### 7.2 Dashboard layout (after the wizard)

- **Top bar:** workspace switcher, map name, usage meter, Share and Report buttons.
- **Left (collapsible):** template insights panel (KPIs, plus a ranked gaps list that is clickable and zooms the map).
- **Centre:** map.
- **Right drawer:** layers, style and filters.
- **Bottom sheet:** data table (toggle), synced with map selection.

### 7.3 Empty states

| Screen | Empty state |
|---|---|
| No maps yet | Three template cards plus "Try with sample paints-dealer data" |
| No territories | "Add a Territory or Rep column, or draw your first territory" with a 20-second GIF |
| No gaps found | "Every pincode with population above X is within R km of a dealer 🎉. Try a smaller radius." |

### 7.4 Error states

- **Upload failed:** name the exact row and column, and offer "Download error rows".
- **Geocode cap reached:** show how many rows remain, plus Buy 5k ($10) / Upgrade / Map the remaining rows at pincode level for free.
- **Google outage:** queue paused, auto-retry, banner shown; already-geocoded data stays usable.
- **Share link expired or revoked:** a friendly page with a "Request access" email to the owner.

### 7.5 Geocoding confidence and correction

- Pins are styled by confidence: solid for High, hollow for Medium, and a dashed pincode-centroid ring for Pincode-level.
- A confidence filter chip is always visible after geocoding.
- The fix-it queue is a side panel listing problem rows. Each row shows:
  - the row's address
  - suggestions (top 3 candidates)
  - a map preview
  - actions: Accept / Drag / Edit / Use pincode
- Keyboard: `J/K` to move between rows, `Enter` to accept.

### 7.6 Mobile-friendly reporting

- Share links are responsive: the KPI cards come first, then the map (static image on screens under 600 px, with a "tap for interactive" option), then tables as cards.
- The PDF is designed to be read in the WhatsApp preview: a large title and a three-KPI summary on page 1.

### 7.7 Accessibility

- WCAG 2.1 AA.
- Colour-blind-safe palettes (ColorBrewer/Viridis classes).
- Never encode meaning by colour alone; confidence also uses shape.
- Full keyboard navigation for the wizard and tables.
- Map features are mirrored in the accessible data table.
- Text contrast of at least 4.5:1.
- Language: English v1, Hindi UI strings P2.

### 7.8 Screen-by-screen outline

1. **Landing / template page**: headline, sample report image, Start free.
2. **Sign up**: Google / email OTP.
3. **Workspace setup**: name, industry, goal template.
4. **Upload**: drop zone / Google Sheet / sample data.
5. **Column mapping**: auto-mapped table with a role dropdown per column and a validation summary.
6. **Geocoding progress**: progress bar, live map filling in, then a result card.
7. **Fix-it queue**.
8. **Template parameters**: radius, boundary level, demand proxy (with defaults).
9. **Analysis dashboard**: map plus KPIs plus a ranked list.
10. **Territory editor** (T2): lasso, a move-to menu, a live balance table.
11. **Report builder**: section toggles, branding, preview.
12. **Share dialog**: link, password, expiry, PDF download.
13. **Usage & billing**: meters, plan cards, invoices.
14. **Workspace settings**: members, roles, domain lock, delete.

---

## 8. Analytics and success metrics

| Stage | Metric | Definition | Target (first 6 months) [Assumption] |
|---|---|---|---|
| Activation | **Time to first successful map** | signup → first map with at least 80% of rows located | Median under 10 min |
| Activation | Activation rate | % of signups that render a map and run 1 template within 7 days | ≥ 40% |
| Data quality | **% rows geocoded** | rows at High+Medium+Pincode-level ÷ uploaded rows | ≥ 95% (≥ 75% High+Medium) |
| Data quality | Fix-it completion | % of failed rows the user fixes | ≥ 50% |
| Engagement | **Reports generated** | PDFs plus share links per active workspace per month | ≥ 3 |
| Engagement | **Weekly active workspaces (WAW)** | workspaces with at least 1 analysis run or report view in the week | Grow 15% MoM |
| Engagement | Share-link views per report | unique viewers | ≥ 3 (proxy for reaching the buyer) |
| Conversion | **Free → paid** | paid within 30 days of signup | 4–7% self-serve; 25%+ from the audit lead magnet |
| Retention | Logo churn | monthly paid-workspace churn | ≤ 4%/month (Starter), ≤ 2% (Team) |
| Expansion | **NRR** | 12-month net revenue retention | ≥ 100% by month 12 (Starter → Team, add-ons) |
| Revenue | MRR, ARPA, gross margin | | $5k MRR by month 6 after paid launch; GM ≥ 75% |
| Cost | Geocode cost per paid workspace | Google spend ÷ paid workspaces | ≤ $5 |

**Instrumentation:** product events (`signup`, `upload_completed`, `mapping_confirmed`, `geocode_completed{success_rate}`, `template_run`, `report_created`, `share_viewed`, `limit_hit{meter}`, `checkout_started`, `subscription_started`) in PostHog, plus the `usage_events` table for billing truth.

---

## 9. Go-to-market plan

### 9.1 Launch strategy

1. **Private pilot (days 30–90).** 10 design partners (free), recruited through outbound to Heads of Distribution. In exchange: weekly feedback and a case study.
2. **Paid launch (days 90–180).**
   - Publish pricing.
   - Product Hunt plus Indian SaaS communities.
   - LinkedIn founder content: "We mapped 1,200 paint dealers in 10 minutes."
   - Template SEO pages.
3. **Sales-assisted Team tier** for companies with more than 500 dealers.

### 9.2 First 100 customers

| Channel | Mechanism | Target |
|---|---|---|
| Founder-led outbound (LinkedIn plus email) | 1,500 Heads of Sales Ops/Distribution at ₹100–2,000 Cr brands in durables, building materials, agri, auto parts, regional FMCG | 40 |
| Free Coverage Audit (lead magnet) | They send a dealer sheet; we return a branded gap report in 48 hours, with an upgrade CTA | 25 |
| Template SEO | "dealer coverage map India", "pincode territory map", "sales territory map Excel" | 15 |
| Partners | Indian DMS/SFA vendors, sales-ops consultants, Tally/Zoho implementation partners | 15 |
| Communities | Sales-ops and RevOps India Slack/LinkedIn groups, distribution-management forums | 5 |

### 9.3 Outbound messaging examples

**To a Head of Distribution (email):**

> Subject: 34 districts, 0 dealers?
>
> Hi Rajesh, most {category} brands we've looked at have 20–40 districts with real demand and no dealer within 25 km, and the gap list usually lives in someone's Excel.
> Send me your dealer list (just name + pincode) and I'll send back a free pincode-level coverage map of {brand}'s network, with the top 20 white-space districts ranked. Takes 48 hours, no call needed.
> Worth a look before your next expansion review?

**To a Sales Ops / MIS lead (LinkedIn):**

> Hey Priya, do you still build the dealer coverage map by hand in PowerPoint? We built a tool that turns the DMS export into a pincode coverage map plus territory balance table in about 10 minutes. Free to try with your own sheet: {link}. Happy to set up the first one with you.

**Follow-up after an audit:**

> Here's {brand}'s coverage report (link). Three things stood out: (1) 612 uncovered pincodes holding ~4.2 Cr people, (2) Pune and PCMC territories overlap on 38 pincodes, (3) the East region carries 2.1× the average dealers per rep. To keep this live off your Google Sheet, it's $50/month: {link}.

### 9.4 Template-led acquisition

Each template gets:

- an SEO landing page
- a sample report (public share link)
- a 60-second video
- a one-click "Try with sample data" button

Launch set:

1. Dealer Coverage Gap
2. Territory Overlap Check
3. Lead → Territory Router (P1)
4. Drive-time Serviceability (P1)

Later: industry variants such as "Paint dealer coverage" and "Agri-input distributor gaps".

### 9.5 Free audit or report as the lead magnet

- Manual at first: the founder runs it in-product (it doubles as dogfooding). Then self-serve: "Upload your sheet → instant watermarked audit; full report on signup."
- Every audit ends in a share link owned by the prospect's workspace, so conversion is a click.

### 9.6 Partnerships and integrations

| Type | Examples | Why |
|---|---|---|
| Data sources | Google Sheets (P0), Excel (P0), Zoho CRM / HubSpot / Salesforce (P2) | Bring data in without exports |
| Distribution management / SFA vendors | Indian DMS/SFA providers [Assumption: identify the top 5 in interviews] | Embed "coverage map" as a partner feature; referral revenue share |
| Consultants | Sales-ops and channel consultants | Use it for client deliverables; reseller margin |
| Google | Google Maps Platform partner programme [Assumption: check eligibility] | Credits, co-marketing |

### 9.7 Pricing-page messaging

- **Headline:** "Enterprise-grade coverage maps. Spreadsheet-level price."
- **Sub-head:** "Start free with 500 rows. $50/month when your whole dealer network is on the map. No sales call, no annual contract, cancel anytime."
- **Proof row:** "Pincode and district boundaries for all of India · Your data stays in India · GST invoice · UPI accepted".
- **FAQ:** "Do I need GIS skills?" (No.) "What counts as a geocode?" (Each new unique address, and re-uploads are free.) "Can I bring my own Google key?" (Yes, on Enterprise.)

---

## 10. Risks and mitigation

| Risk | Likelihood / Impact | Mitigation |
|---|---|---|
| **Map API cost** (Google price changes; heavy users) | M / H | Meter geocodes by unique address; pooled free tier; add-on packs; BYO key for big users; open-only mode (§6.1) as a fallback; track $/workspace weekly |
| **Google terms** (caching, display on Google maps only) | M / H | Render Google-derived data only on Google Maps; store place IDs; re-geocode stale coordinates; legal review before launch (§12). If export of geocoded coordinates (G6) is disallowed, export pincode-level data only |
| **Data quality** (messy Indian addresses, wrong pincodes) | H / M | Pincode-first analysis; confidence labels; reject geocodes outside the pincode; fix-it queue; sample-file benchmark (spike) |
| **Enterprise incumbents** (Mappls, Esri, GEOIQ) | M / M | Avoid their strengths (proprietary data, depth); win on price transparency, time to value and a narrow persona. Their enterprise motion makes a $50 self-serve tier hard for them to prioritise [Assumption] |
| **Competitive response** (ClarityX publishes a low price; Mappls launches templates) | M / H | Move fast on templates plus reporting and the distribution persona; build switching costs (live Sheets sync, territory history, team workflows); community and content moat |
| **Compliance and privacy** (DPDP, customer PII in uploads) | M / H | India residency, DPA, PII-column exclusion, deletion SLAs, sub-processor list; legal review |
| **Low GIS literacy** | H / M | Templates, wizard, defaults, plain-language outputs ("appoint a dealer here"), sample data, onboarding call on Team |
| **Feature creep** (users ask for full GIS) | H / M | Non-goals list (§3.3); every request mapped to a template or rejected; quarterly scope review |
| **Founder employment / IP conflict** (founder currently employed at MapmyIndia) | **M / H** | **Review the employment agreement (IP assignment, non-compete, moonlighting, confidentiality) with a lawyer before building or selling.** Use only public information and the open/Google stack; no MapmyIndia code, data, customer lists or internal pricing (§12) |
| **Open data licence/vintage** (pincode boundaries outdated or licence unclear) | M / M | Verify the licence on the original data.gov.in page; show the vintage; let users override a point's pincode; monitor updates |

---

## 11. Roadmap

### 0–30 days: validation and design

- 20 customer interviews (10 Heads of Distribution, 10 Sales Ops). Validate the JTBD, current workflow, WTP (Van Westendorp) and data availability.
- Collect 10 real (anonymised) dealer sheets.
- **Technical spikes:**
  1. Google Geocoding India accuracy on 2,000 real addresses: % ROOFTOP/RANGE, % outside the pincode.
  2. Load the data.gov.in pincode GeoJSON and validate geometry and coverage.
  3. Valhalla India isochrone latency and memory.
  4. deck.gl + Google Maps with 50k points.
- Legal: Google terms (caching, export), DPDP processor obligations, founder employment and IP review.
- Design: clickable Figma of the wizard, T1 dashboard and report. Usability test with 5 analysts.
- **Exit criteria:** at least 8 of 20 say "would pay $50/month"; at least 5 design partners commit with data.

### 30–90 days: MVP build and pilot

- Build the P0 scope (one-page MVP below). Supabase Mumbai project, CI, RLS tests.
- Onboard 10 design partners. Weekly releases. Track time-to-first-map and geocode success.
- Run 30 manual Coverage Audits from outbound.
- **Exit criteria:** median TTFM under 10 minutes; at least 95% rows located; at least 6 of 10 partners say they'd be "very disappointed" without it.

### 90–180 days: paid launch

- Billing (Razorpay/Stripe), plan limits, usage page, published pricing.
- P1: Google Sheets sync, T3 assignment, T4 drive-time, heatmap/bubble, report editing, domain lock, audit log.
- Launch: Product Hunt, template SEO pages, LinkedIn content cadence, partner outreach.
- **Exit criteria:** 50 paying workspaces; free→paid at least 4%; GM at least 75%.

### 6–12 months: expansion

- CRM connectors (Zoho, HubSpot, Salesforce); API for lead routing.
- Auto-balanced territory proposals (T5), before/after comparisons, serviceability (R3).
- Hindi UI; mobile-optimised viewer for regional heads.
- Team/Enterprise: SSO, DPA templates, security pack.
- Global: US ZIP / UK postcode boundaries, reusing the template engine.
- **Target:** 100+ paying customers; NRR at least 100%.

---

## 12. Open questions

| # | Question | How to answer |
|---|---|---|
| 1 | Does the founder's MapmyIndia employment agreement (IP assignment, non-compete, moonlighting, confidentiality) permit building and selling this product while employed? | **Lawyer review of the employment contract before any build or customer contact.** Keep all work on personal time and devices, and use public information only |
| 2 | Exact current Google terms: lat/lng caching window, displaying on non-Google maps, exporting geocoded coordinates to customers | Legal read of the Maps Service Specific Terms; written confirmation from a Google Maps partner if needed |
| 3 | Is $50/month the right Starter price for Indian buyers? Is INR pricing (₹3,999) better than USD? | Van Westendorp in interviews; live checkout A/B ($39 / $50 / $79) |
| 4 | ClarityX mGIS Pro price and real limits (rows, geocodes)? | Sign up for the Starter trial and go through upgrade checkout; ask in sales conversations (Not publicly available on https://clarityx.ai/mgis/) |
| 5 | GEOIQ and Mappls mGIS entry prices? | Prospect interviews ("what were you quoted?"); G2/Capterra reviews |
| 6 | Google Geocoding accuracy on real Indian dealer addresses (urban vs rural)? | Spike on 2,000 real addresses with ground-truth pins from design partners |
| 7 | Licence and vintage of the data.gov.in pincode boundaries; best open district boundary source; licence terms of GHSL/WorldPop for commercial SaaS | Read the licence fields on the source pages; email ndsap@gov.in if unclear |
| 8 | Is "population" a good enough demand proxy, or do buyers insist on affluence data? | Interviews: show T1 output with population only and measure "would act on this?" |
| 9 | Which DMS/SFA tools do target buyers use, and do they have APIs or marketplaces? | Interviews; vendor partner pages |
| 10 | Do buyers need on-prem, or a security review, at mid-market? | Ask in interviews; track lost deals by reason |
| 11 | Should drive-time be P0 for any segment (e.g., logistics)? | Count interview mentions; pilot usage of radius vs drive-time requests |
| 12 | Product name and trademark availability (Beatmap / GeoSheets / Territo) | Indian TM registry search (class 9/42); domain check |

---

## Sources

**Primary (vendor/official):**

- Mappls mGIS: https://about.mappls.com/mgis/
- ClarityX mGIS (plans and features): https://clarityx.ai/mgis/
- Esri ArcGIS Online pricing (user types, credits; prices via sales): https://www.esri.com/en-us/arcgis/products/arcgis-online/pricing
- Esri Business Analyst pricing page: https://go.esri.com/ba/pricing
- Google Maps Platform India pricing: https://developers.google.com/maps/billing-and-pricing/pricing-india · https://mapsplatform.google.com/intl/en_in/pricing/
- Google Maps Platform Service Specific Terms: https://cloud.google.com/maps-platform/terms/maps-service-terms
- Nominatim usage policy: https://operations.osmfoundation.org/policies/nominatim/
- India pincode boundaries: https://data.gov.in/resource/delivery-post-office-pincode-boundary · https://aikosh.indiaai.gov.in/home/datasets/details/all_india_pincode_boundary_geo_json.html
- MapmyIndia mGIS brochure "Spatial Analytics platform" (2021-07-29), provided by the author

**Third-party (lower confidence; verify before quoting externally):**

- ArcGIS Business Analyst pricing on G2: https://g2.com/products/arcgis-business-analyst/pricing
- ArcGIS BA Advanced bundle on AWS Marketplace: https://aws.amazon.com/marketplace/pp/B0B1JTPQTT
- GEOIQ pricing on G2: https://www.g2.com/products/geoiq/pricing
- GEOIQ funding and customers (Techloy): https://www.techloy.com/indian-location-intelligence-startup-geoiq-raises-2-25-million.md
- Maptive vs eSpatial (G2): https://www.g2.com/compare/maptive-vs-espatial
- Maptive, sales mapping software: https://www.maptive.com/best-sales-mapping-software/

**Research gaps (not done in this pass):**

- No customer reviews, Reddit/community threads or industry reports were collected as demand evidence. Demand claims are therefore marked [Assumption], and the §11 interviews are the validation path.
- geoiq.ai returned no readable content, so GEOIQ features come from third-party sources.

---

## One-page MVP specification (P0 only)

**Goal:** a sales-ops analyst uploads a dealer sheet and, in under 10 minutes, shares a pincode coverage-gap report and a territory balance view.

**Users:** Owner, Editor, Viewer. One workspace per company.

**P0 features**

1. **Auth and workspace** (A1, A2): Google/email-OTP sign-in; invite teammates; roles; seat caps.
2. **Import** (D1, D2): CSV/XLSX up to 20 MB / 50k rows; sheet picker; validation summary.
3. **Column mapping** (C1, C2): auto-map name, address, city, district, state, pincode, lat/lng, category, rep/territory, metric; manual override.
4. **Geocoding** (G1–G5): background batch job; cascade of existing lat/lng → workspace cache → Google Geocoding (India) → pincode centroid; confidence labels; pincode-consistency check; fix-it queue; metered by unique address with a server-side hard cap.
5. **Map** (M1–M3, V1, V2): Google Maps JS + deck.gl; points, clusters, category colours; pincode/district choropleth; filters; feature popups.
6. **Boundaries** (B1, B2): India state, district and pincode boundaries from open data as vector tiles; each record tagged with its pincode, district and state.
7. **T1 Dealer Coverage Gap** (S1, S2, R1): radius-based coverage; Covered/Thin/Uncovered classes; Gap Score with visible weights; radius rings.
8. **T2 Territory Overlap and Balance** (T1–T3): territories from a column; overlap and unassigned flags; lasso reassignment; balance table.
9. **Report and share** (P1r, P2r, X1–X3): one-click report with KPIs, map, ranked gaps, balance table, three rule-based actions and methodology; view-only share link (password/expiry); PDF (watermarked on Free); CSV export.
10. **Billing and limits** (L1–L3): Free and $50 Starter plans; Razorpay (INR/UPI/GST) plus Stripe; usage page; server-side enforcement.
11. **Security** (S-1–S-3): Supabase Postgres + PostGIS in Mumbai; RLS on all tenant tables with CI tests; encryption; self-serve workspace deletion.

**Out of scope for MVP:** Google Sheets sync, drive-time isochrones, heatmap/bubble, lead auto-assignment, comments, SSO, CRM connectors, AI summaries, any non-India geography, any Mappls/MapmyIndia API or data.

**Launch gates:**

- Median time to first map under 10 minutes.
- At least 95% of rows located, with at least 75% at High/Medium confidence.
- Cross-tenant RLS tests pass.
- Legal sign-off on Google terms, DPDP and the founder employment/IP review.
- 10 design partners onboarded.
