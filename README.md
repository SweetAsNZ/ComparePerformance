# Catamaran Comparison

Interactive web application for comparing 3 catamaran models side-by-side using naval architecture formulas, VPP polar extrapolation, and manufacturer specifications based on [CatamaranShow.com](https://www.catamaranshow.com/comparecatamarans?key1=Fountaine+Pajot+45+Elba&key2=Fountaine+Pajot+47+Tanna&key3=Fountaine+Pajot+51+Aura).

## Live Website

🔗 **[https://sweetasnz.github.io/ComparePerformance/](https://sweetasnz.github.io/ComparePerformance/)**

Compare specific models directly via URL parameters, e.g.:

- `https://sweetasnz.github.io/ComparePerformance/?key1=Fountaine+Pajot+45+Elba&key2=Fountaine+Pajot+47+Tanna&key3=Fountaine+Pajot+51+Aura`

## Features

- **Side-by-Side 3-Boat Selection**: Compare any 3 models simultaneously from top builders including Fountaine Pajot, Lagoon, Leopard, Outremer, Balance, HH Catamarans, Nautitech, Bali, Seawind, Neel Trimarans, and Gunboat.
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
  - **Bulk import from multiple PDFs/CSVs at once, or pasted text (Research Import)**: Select any mix of quote/invoice/spec PDFs (parsed client-side via PDF.js) and CSVs together in one go (no need to sort them first), or paste copied HTML/table/text from a manufacturer, broker, forum (e.g. CruisersForum.com), or social-media post. We do **not** log into Facebook or any other platform on your behalf, or store credentials/MFA codes — you stay logged in and copy the text yourself, then paste it in. Provenance is worked out automatically rather than asked for: file imports are tagged with the originating file name, and pasted text is tagged with any link it contains. Parsed rows land in a staging table for review/editing before being added to a boat.
  - **Automatic Equipment / Spare / Maintenance Log classification**: Every parsed row is auto-detected from its wording (e.g. "serviced"/"replaced"/"inspection" → Maintenance Log, "spare"/"backup" → Spare, otherwise Equipment) and shown with an editable per-row "Kind" dropdown in the staging table so you can fix any misclassification before adding. CSV headers are flexible: any of Name/Description, Category, RRP/Cost/Amount, Install Cost, Install Date/Date, Life Expectancy (yrs) are recognized. Each boat card has its own Equipment / Spares / Maintenance sub-tabs.
  - **Category auto-guessing & life-expectancy defaults**: e.g. engines 20 yrs, sails 10 yrs, electronics 8 yrs, batteries 6 yrs, applied automatically when not supplied.
  - **Age & replacement tracking**: Each equipment/spare item shows its age, a computed replacement-due date, and an OK / Due Soon / Overdue status badge.
  - **Straight-line depreciation**: Each item's "value today" depreciates linearly from its as-new cost (RRP + install) to $0 at the end of its life expectancy; spares depreciate/expire the same way. Maintenance log entries are a simple spend record and don't affect depreciation.
  - **"Comparative Price"**: Enter each boat's asking/list price. The app computes **My Buy Price** (asking price minus accrued equipment+spares depreciation), then automatically benchmarks the boats you're comparing against each other — picking the best-equipped item in every category — and adds the **cost to buy & install** whatever that boat is missing, to produce one final **Comparative Price** per boat so they can be judged on a like-for-like, equally-equipped basis. No setup is required; an optional "Model Boat" designation and/or starring (★) individual items can override the automatic benchmark per category.
  - **Backup / restore**: Export/import your whole equipment, spares and maintenance-log catalogue as a JSON file, or export a single boat's equipment/spares as CSV. All data is stored only in your browser's local storage — nothing is uploaded.

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
