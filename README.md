# Catamaran Performance Comparator

Interactive web application for comparing 3 catamaran models side-by-side using naval architecture formulas, VPP polar extrapolation, and manufacturer specifications based on [CatamaranShow.com](https://www.catamaranshow.com/comparecatamarans?key1=Fountaine+Pajot+45+Elba&key2=Fountaine+Pajot+47+Tanna&key3=Fountaine+Pajot+51+Aura).

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
- **Velocity Prediction Program (VPP) Simulator**: Real-time sliders for True Wind Speed (TWS) and True Wind Angle (TWA) to calculate instantaneous boat speed and windspeed percentage.
- **Comprehensive Specifications Table**: Length, beam, draft, light/loaded displacement, sail areas, mast air draft, bridgedeck clearance, fuel/water tankage, cabins/berths, keels, helm type, steering, engines, and pricing.
- **Metric & Imperial Toggle**: Instant unit switching.
- **URL Query Deep Linking & Sharing**: Share exact 3-boat comparisons via URL (e.g. `?key1=Fountaine+Pajot+45+Elba&key2=Fountaine+Pajot+47+Tanna&key3=Fountaine+Pajot+51+Aura`).

## How to Run

Simply open [index.html](index.html) in any modern web browser (Edge, Chrome, Firefox, Safari) or serve with any static web server:

```bash
# Using Python built-in server:
python -m http.server 8000
# Then navigate to:
# http://localhost:8000/?key1=Fountaine+Pajot+45+Elba&key2=Fountaine+Pajot+47+Tanna&key3=Fountaine+Pajot+51+Aura
```
