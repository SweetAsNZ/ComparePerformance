# Catamaran Comparison

Interactive web application for comparing 3 catamaran models side-by-side using naval architecture formulas, VPP polar extrapolation, and manufacturer specifications based on [CatamaranShow.com](https://www.catamaranshow.com/comparecatamarans?key1=Fountaine+Pajot+45+Elba&key2=Fountaine+Pajot+47+Tanna&key3=Fountaine+Pajot+51+Aura).

## Live Website

🔗 **[https://sweetasnz.github.io/ComparePerformance/](https://sweetasnz.github.io/ComparePerformance/)**

Compare specific models directly via URL parameters, e.g.:

- `https://sweetasnz.github.io/ComparePerformance/?key1=Fountaine+Pajot+45+Elba&key2=Fountaine+Pajot+47+Tanna&key3=Fountaine+Pajot+51+Aura`

## Features

- **Side-by-Side 3-Boat Selection**: Compare any 3 models simultaneously from top builders including Fountaine Pajot, Lagoon, Leopard, Outremer, Balance, HH Catamarans, Nautitech, Bali, Seawind, Neel Trimarans, Catana, Privilège, and Gunboat — spanning classic/legacy models from 2008 through the latest current-production designs.
- **Model ordering**: Comparison and VPP dropdowns are grouped alphabetically by manufacturer, then ordered by overall length (LOA), smallest first. Models of equal length are ordered by name. This includes **Island Spirit 40 and Island Spirit 525** under Island Spirit. This order is retained when filtering; a selected boat outside the active filters remains pinned above the groups. The fleet speed graph remains ranked by predicted speed.
- **Older Fountaine Pajots**: The Fountaine Pajot dropdown group also includes **Mahé 36, Lavezzi 40, Lipari 41, Orana 44 and Salina 48**, including models launched before 2008 but still in production during that period. Salina Evolution and Lipari Evolution boats use their respective model entries.
- **Antares**: **Antares 44** is available under Antares Catamarans in the comparison and VPP selectors, and in the fleet speed graph. Dimensions, sail areas and tankage use the [builder's published metric specifications](https://www.antarescatamarans.com/models/antares-44/); the 44/44i lineage and construction are also covered by [Blue Water Sailing's 44i review](https://www.bwsailing.com/cc/2016/06/antares-44i/) and [reported Antares 44 specifications](https://boatsector.com/specifications-antares-44/). The loaded displacement is a cruising assumption, not a certified maximum; the derived payload is a comparison input, not a rated capacity. Polar curves are illustrative estimates, not measured manufacturer polars. Market price is unassessed, so enter the individual boat's asking price and reset price filters to see this model.
- **Naval Architecture Mathematical Engine**:
  - **Bruce Number**: $\frac{\sqrt{\text{Sail Area (sq ft)}}}{\sqrt[3]{\text{Displacement (lbs)}}}$
  - **Derek Kelsall Performance Index**: $\frac{\text{LWL (ft)} \times \text{Bruce Number}}{70}$
  - **Sail Area to Displacement ($SA/D$)**: $\frac{\text{Sail Area (sq ft)}}{(\text{Displacement (lbs)} / 64)^{2/3}}$
  - **Displacement to Length Ratio ($D/L$)**: $\frac{\text{Displacement (long tons)}}{(0.01 \times \text{LWL (ft)})^3}$
  - **Sail Performance (% of Windspeed)** & Estimated Boat Speed
- **Dynamic Performance Gauges**: Visual indicators across 4 performance bands: *Slow*, *Cruiser*, *Performance*, *Racer*.
- **Interactive VPP Polar Diagrams & Radar Matrix**: HTML5 canvas rendering comparative speed polar curves across $8$, $12$, $16$, $20$, and $25\text{ kn}$ true wind speeds, plus a 6-axis design balance radar spider chart.
- **Velocity Prediction Program (VPP) & Sail Reefing Simulator**:
  - Real-time **True Wind Speed (TWS)** slider (2 to 45 kn) with wind preset buttons (Light, Moderate, Fresh, Strong, Gale).
  - Real-time **True Wind Angle (TWA)** slider (30° to 180°) with points-of-sail presets (*Close Hauled*, *Close Reach*, *Beam Reach*, *Broad Reach*, *Dead Run*).
  - **Mainsail Reefing Controls**: Full Main (100%), Reef 1 (82%), Reef 2 (64%), Reef 3 (45%), Dropped/Furled (0%).
  - **Headsail Selection & Furling**: Standard Genoa (110%), Self-tacking Jib / Solent, Code 0 / Gennaker / Screecher, Code D Furling Spinnaker, Parasailor, Asymmetrical Spinnaker, Storm Jib, plus furling stages (100%, 75%, 50%, 25%, 0%).
  - **Cruising Payload Loading Factor**: Lightship (+0 kg), Normal Cruising (+1,500 kg), Liveaboard (+3,000 kg), Expedition (+4,500 kg).
  - **Sea State Modeling**: Significant wave height, dominant period, and direction relative to the bow reduce predicted speed for steep, large, and head-on seas, with an additional strong-wind interaction.
  - **Aerodynamic Vector Plotter**: Interactive canvas showing heading, true wind vector, apparent wind vector ($AWS$ & $AWA$), and boat speed.
  - **Comprehensive Telemetry per Boat**: Real-time boat speed, % of windspeed, Apparent Wind Speed/Angle, Upwind/Downwind VMG, Active Sail Area, and Rig Safety / Overpower warnings.
- **Comprehensive Specifications Table**: Length, beam, draft, light/loaded displacement, sail areas, mast air draft, bridgedeck clearance, fuel/water tankage, cabins/berths, keels, helm type, steering, engines, and pricing.
- **Metric & Imperial Toggle**: Instant unit switching.
- **URL Query Deep Linking & Sharing**: Share exact 3-boat comparisons via URL (e.g. `?key1=Fountaine+Pajot+45+Elba&key2=Fountaine+Pajot+47+Tanna&key3=Fountaine+Pajot+51+Aura`).
- **Equipment, Spares, Maintenance History & "Comparative Price"** (tab: *Equipment & Comparative Price*):
  - **Named target tabs**: The "Add new / parsed rows to" buttons show each selected boat's actual name (e.g. "Elba 45") instead of a generic "Boat 1/2/3", so it's always clear which real boat new or imported rows are going to.
  - **Real boat name, auto-detected from a folder (or typed in)**: Use the "📁 Or import a whole folder" option to select an entire folder of PDFs/CSVs at once (e.g. "FP Saona 47 Seaduction") - the specific real boat's own name ("Seaduction") is worked out automatically by stripping the make/model/length portion from the folder name, and shown right on its card (e.g. `Fountaine Pajot Saona 47 — "Seaduction"`). It never overwrites a name that's already set; there's also a "Boat Name" field on each card to type/correct it directly.
  - **Bulk import from multiple PDFs/CSVs at once, or pasted text/HTML (Research Import)**: Select any mix of quote/invoice/spec PDFs (parsed client-side via PDF.js) and CSVs together in one go (no need to sort them first), or paste copied content from a manufacturer, broker, forum (e.g. CruisersForum.com), or social-media post. Three paste styles are all auto-detected and handled: plain visible text, a copied HTML `<table>`, or an entire page's raw HTML source (e.g. "View Page Source" → select all → copy → paste) — full-page HTML is stripped down to its readable text (scripts/styles removed, block elements turned into line breaks) before parsing. We do **not** log into Facebook or any other platform on your behalf, or store credentials/MFA codes — you stay logged in and copy the content yourself, then paste it in. Provenance is worked out automatically rather than asked for: file imports are tagged with the originating file name; pasted HTML is tagged with its canonical link/page title where present, and pasted text is tagged with any link it contains. Parsed rows land in a staging table for review/editing before being added to a boat — a "▾ Minimize" button lets you collapse that (potentially huge) table down to just the count/"Add checked rows"/"Discard" buttons once you're done reviewing, without losing your checkbox selections.
  - **Automatic Equipment / Spare / Maintenance Log classification**: Every parsed row is auto-detected from its wording (e.g. "serviced"/"replaced"/"inspection" → Maintenance Log, "spare"/"backup" → Spare, otherwise Equipment) and shown with an editable per-row "Kind" dropdown in the staging table so you can fix any misclassification before adding. A telling file name (e.g. "Spares List.pdf") also nudges classification when a line's own wording isn't distinctive. CSV headers are flexible: any of Name/Description, Category, RRP/Cost/Amount, Install Cost, Install Date/Date, Life Expectancy (yrs), Hours/Engine Hours, Life Expectancy Hours are recognized. Each boat card has its own Equipment / Spares / Maintenance sub-tabs.
  - **Never a hard "no rows found"**: Many real equipment/spares lists and PDF narratives don't itemize a dollar amount per line. Lines with a recognizable amount ($, £, €, a currency code, or a plain decimal like "1,850.00") are parsed as RRP/cost as before; every other substantive line still becomes an editable row with RRP $0 rather than being silently dropped. Large batches (e.g. a whole narrative PDF) default to unticked in the staging table so you can deliberately pick what's worth keeping instead of having to untick hundreds of rows.
  - **Category auto-guessing & life-expectancy defaults**: e.g. engines 20 yrs, sails 10 yrs, electronics 8 yrs, batteries 6 yrs, applied automatically when not supplied.
  - **Age & replacement tracking (by calendar age or running hours)**: Each equipment/spare item shows its age, a computed replacement-due date, and an OK / Due Soon / Overdue status badge based on straight-line age-based depreciation. Engines and generators can additionally be tracked by **running hours** (Hours / Life (hrs) columns, defaulting to a 5,000-hour life expectancy) — when hours are logged, they take over from calendar age entirely, since a low-hours engine on an older boat genuinely isn't due for replacement just because years have passed.
  - **Straight-line depreciation**: Each item's "value today" depreciates linearly from its as-new cost (RRP + install) to $0 at the end of its life expectancy (by age, or by hours for engines/generators where tracked); spares depreciate/expire the same way. Maintenance log entries are a simple spend record and don't affect depreciation.
  - **"Comparative Price"**: Enter each boat's asking/list price. The app computes **My Buy Price** (asking price minus accrued equipment+spares depreciation), then automatically benchmarks the boats you're comparing against each other — picking the best-equipped item in every category — and adds the **cost to buy & install** whatever that boat is **genuinely missing or has let run overdue** to produce one final **Comparative Price** per boat so they can be judged on a like-for-like, equally-equipped basis. Crucially, a boat is **never** charged for "upgrading" an item it already has in good standing just because another boat's equivalent costs more or is newer-spec — this applies especially to engines (and other high-priced items), which are only ever counted as needing replacement once they're genuinely overdue (by hours or age), not merely different or cheaper. No setup is required; an optional "Model Boat" designation and/or starring (★) individual items can override the automatic benchmark per category.
  - **"Possible Charter Boat" indicator**: Each boat card is automatically screened against a charter-fit-out heuristic — modest solar (< 2,000W) and house-bank capacity (< 1,000Ah @ 12V-equivalent), a small tender outboard (< 10hp), 4+ cabins, a non-lithium battery bank, and no Code 0/D, gennaker, spinnaker, or parasailor/screecher in the sail inventory (all signals real charter operators tend to favour or avoid). Solar/battery/tender figures and lithium/sail status are read automatically from your logged equipment; enter the boat's actual cabin count once per boat. If enough of these line up, a "⚠ Possible Charter Boat" badge appears with a 1–5 star confidence rating and the matched reasons — but a flagged boat is never excluded: per the stated preference ("I do not want a charter boat unless the price is good and the maintenance is very good"), the badge also tells you whether this one is priced well below its Comparative Price **and** has a well-documented maintenance history, which is the only situation worth a closer look.
  - **Backup / restore**: Export/import your whole equipment, spares and maintenance-log catalogue as a JSON file, or export a single boat's equipment/spares as CSV. All data is stored only in your browser's local storage — nothing is uploaded.

## Legacy Fountaine Pajot Data

The five older Fountaine Pajots use reference configurations, not hull-specific surveys. Published specifications vary between original, Evolution and optional-equipment configurations; production spans marked approximate are not exact hull-build date ranges.

Specification references:

- [Salina 48: Boat-Specs](https://www.boat-specs.com/sailing/sailboats/fountaine-pajot/salina-48) and [reported specifications](https://boatsector.com/specifications-salina-48/).
- [Orana 44: builder brochure](https://pdf.nauticexpo.com/pdf/fountaine-pajot-catamarans/orana/20167-25047.html).
- [Lipari 41: builder brochure](https://pdf.nauticexpo.com/pdf/fountaine-pajot-catamarans/lipari/20167-25045.html).
- [Mahé 36: Multihulls World specifications](https://www.multihulls-world.com/technical-specifications/fountaine-pajot/mahe-36).
- [Lavezzi 40: reported specifications](https://boatsector.com/specifications-lavezzi-40/).

Loaded displacement, payload, Code 0 area, mast and bridgedeck clearances are comparison estimates for these entries; Salina LWL is also estimated. The polar grids are illustrative cruising-class estimates, **not measured manufacturer polars**. These limitations are displayed on the model cards. Confirm actual specifications, core construction and safe loading from the individual boat's documents.

No verified market-price average is asserted for these five entries; enter the individual boat's asking price in the equipment comparison. Active price filters exclude models without an assessed price, so use **Reset** to see the entire catalogue.

Run the catalogue regression tests with Node.js (no packages required):

```text
node --test catalogue.test.js
```

## How to Run

This app is a static website and must be served from a local web server. If you open the raw HTML file directly or try to access a stale localhost tab that is not serving the app, the browser will fail with a `chrome-error://` page.

From the project folder, run:

```bash
python ensure_local_server.py
```

This starts a local Python HTTP server on:

```text
http://127.0.0.1:8000/?key1=Fountaine+Pajot+45+Elba&key2=Fountaine+Pajot+47+Tanna&key3=Fountaine+Pajot+51+Aura
```

Alternative manual start:

```bash
cd path\to\ComparePerformance
python -m http.server 8000 --bind 127.0.0.1
```

Then open the URL above in your browser.

## Run at Machine Startup (Windows)

To make the app start automatically when Windows logs in:

1. Create a shortcut to `start_compare_performance.cmd` in this project folder.
2. Copy the shortcut into:
   `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`
3. Restart the machine, or log out and back in.

The startup helper runs the local server without opening the browser automatically, so it stays available on port `8000` for the app.

If you want to start it manually via a batch file instead, use:

```bat
cd /d "C:\path\to\ComparePerformance"
python ensure_local_server.py
```
