# Catamaran Performance Comparator

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
  - **Headsail Selection & Furling**: Standard Genoa (110%), Self-tacking Jib / Solent, Code 0 / Gennaker / Screecher, Asymmetrical Spinnaker, Storm Jib, plus furling stages (100%, 75%, 50%, 25%, 0%).
  - **Cruising Payload Loading Factor**: Lightship (+0 kg), Normal Cruising (+1,500 kg), Liveaboard (+3,000 kg), Expedition (+4,500 kg).
  - **Aerodynamic Vector Plotter**: Interactive canvas showing heading, true wind vector, apparent wind vector ($AWS$ & $AWA$), and boat speed.
  - **Comprehensive Telemetry per Boat**: Real-time boat speed, % of windspeed, Apparent Wind Speed/Angle, Upwind/Downwind VMG, Active Sail Area, and Rig Safety / Overpower warnings.
- **Comprehensive Specifications Table**: Length, beam, draft, light/loaded displacement, sail areas, mast air draft, bridgedeck clearance, fuel/water tankage, cabins/berths, keels, helm type, steering, engines, and pricing.
- **Metric & Imperial Toggle**: Instant unit switching.
- **URL Query Deep Linking & Sharing**: Share exact 3-boat comparisons via URL (e.g. `?key1=Fountaine+Pajot+45+Elba&key2=Fountaine+Pajot+47+Tanna&key3=Fountaine+Pajot+51+Aura`).

## To Do

[ ] Add sea state drop down with wave height, period and direction and change the boat speed based on the sea state in the polars table and graph.

## How to Run

Simply open [index.html](index.html) in any modern web browser (Edge, Chrome, Firefox, Safari) or serve with any static web server:

```bash
# Using Python built-in server:
python -m http.server 8000
# Then navigate to:
# http://localhost:8000/?key1=Fountaine+Pajot+45+Elba&key2=Fountaine+Pajot+47+Tanna&key3=Fountaine+Pajot+51+Aura
```
