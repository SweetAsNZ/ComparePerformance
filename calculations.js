/**
 * Naval Architecture & Performance Mathematical Calculations for Catamarans
 * Based on Bruce Number, Derek Kelsall Performance Index, SA/D, D/L, and Multihull VPP Hydrodynamics
 */

const NAVAL_MATH = {
  // Conversion Constants
  M_TO_FT: 3.28084,
  FT_TO_M: 0.3048,
  M2_TO_FT2: 10.7639,
  FT2_TO_M2: 0.092903,
  TONNES_TO_LBS: 2204.6226,
  LBS_TO_TONNES: 0.000453592,
  L_TO_GAL: 0.264172,
  GAL_TO_L: 3.78541,

  /**
   * Convert metric specs into full metric and imperial values and calculate key ratios
   */
  calculateBoatMetrics(boat) {
    const s = boat.specs;
    
    // Core dimensions
    const loa_ft = s.loa_m * this.M_TO_FT;
    const lwl_ft = s.lwl_m * this.M_TO_FT;
    const boa_ft = s.boa_m * this.M_TO_FT;
    const draft_min_ft = s.draft_min_m * this.M_TO_FT;
    const draft_max_ft = s.draft_max_m * this.M_TO_FT;
    const disp_light_lbs = s.displacement_light_t * this.TONNES_TO_LBS;
    const disp_loaded_lbs = s.displacement_loaded_t * this.TONNES_TO_LBS;
    const sa_upwind_ft2 = s.sail_area_upwind_m2 * this.M2_TO_FT2;
    const sa_main_ft2 = s.mainsail_area_m2 * this.M2_TO_FT2;
    const sa_genoa_ft2 = s.genoa_area_m2 * this.M2_TO_FT2;
    const sa_gennaker_ft2 = (s.gennaker_code0_m2 || 0) * this.M2_TO_FT2;
    const mast_clearance_ft = (s.mast_clearance_m || 0) * this.M_TO_FT;
    const bridgedeck_ft = (s.bridgedeck_clearance_m || 0) * this.M_TO_FT;
    const fuel_gal = s.fuel_capacity_l * this.L_TO_GAL;
    const water_gal = s.water_capacity_l * this.L_TO_GAL;
    const payload_lbs = (s.payload_capacity_kg || 0) * 2.20462;

    // 1. Bruce Number: sqrt(SA_sqft) / cbrt(Disp_lbs)
    const bruceNumber = Math.sqrt(sa_upwind_ft2) / Math.cbrt(disp_light_lbs);

    // 2. Kelsall Index: (LWL_ft * Bruce Number) / 70
    const kelsallIndex = (lwl_ft * bruceNumber) / 70.0;

    // 3. Sail Area to Displacement (SA/D): SA_sqft / (Disp_lbs / 64)^(2/3)
    const saDispRatio = sa_upwind_ft2 / Math.pow(disp_light_lbs / 64.0, 2.0 / 3.0);

    // 4. Displacement to Length Ratio (D/L): (Disp_lbs / 2240) / (0.01 * LWL_ft)^3
    const dispLengthRatio = (disp_light_lbs / 2240.0) / Math.pow(0.01 * lwl_ft, 3);

    // 5. Theoretical Monohull Hull Speed: 1.34 * sqrt(LWL_ft)
    const hullSpeed = 1.34 * Math.sqrt(lwl_ft);

    // 6. Extrapolated Reaching Boat Speed at 15-18kn true wind
    const estimatedBoatSpeed = Math.round((hullSpeed * Math.pow(bruceNumber, 0.95) * 0.96) * 10) / 10;

    // 7. Sail Performance (% of 15-knot true wind)
    const sailPerformancePercent = Math.round((estimatedBoatSpeed / 15.0) * 100);

    // 8. Overall Maximum Speed & Optimal Reaching Angle from Polar Matrix
    const maxPolar = this.calculateMaxPolarSpeed(boat);

    // 9. Optimum Upwind VMG and Target Tack Angle
    const upwindTarget = this.calculateOptimumUpwind(boat, 15);

    // 10. Other Multihull naval architecture indicators
    const lwlBeamRatio = lwl_ft / (boa_ft * 0.22);
    const beamLengthRatio = s.boa_m / s.loa_m;
    const bridgedeckRatio = s.bridgedeck_clearance_m / s.lwl_m;

    // Gauge positioning:
    const indicators = {
      sailPerf: {
        value: sailPerformancePercent,
        unit: "%",
        label: "Sail Performance",
        sublabel: "% of wind speed",
        category: this.classifySailPerf(sailPerformancePercent),
        barPercent: this.scaleToBar(sailPerformancePercent, 45, 115),
        zones: [
          { name: "Slow", min: 45, max: 62 },
          { name: "Cruiser", min: 62, max: 74 },
          { name: "Performance", min: 74, max: 90 },
          { name: "Racer", min: 90, max: 115 }
        ]
      },
      boatSpeed: {
        value: estimatedBoatSpeed,
        unit: "kn",
        label: "Boat Speed",
        sublabel: "at 15kn wind (kn)",
        category: this.classifyBoatSpeed(estimatedBoatSpeed),
        barPercent: this.scaleToBar(estimatedBoatSpeed, 7.5, 17.5),
        zones: [
          { name: "Slow", min: 7.5, max: 9.8 },
          { name: "Cruiser", min: 9.8, max: 11.6 },
          { name: "Performance", min: 11.6, max: 14.2 },
          { name: "Racer", min: 14.2, max: 17.5 }
        ]
      },
      maxSpeed: {
        value: maxPolar.maxSpeed,
        unit: "kn",
        label: "Max Polar Speed",
        sublabel: `@ ${maxPolar.twa}° TWA in ${maxPolar.tws}kn TWS`,
        category: this.classifyBoatSpeed(maxPolar.maxSpeed),
        barPercent: this.scaleToBar(maxPolar.maxSpeed, 9.0, 26.0),
        zones: [
          { name: "Slow", min: 9.0, max: 9.8 },
          { name: "Cruiser", min: 9.8, max: 11.6 },
          { name: "Performance", min: 11.6, max: 14.2 },
          { name: "Racer", min: 14.2, max: 26.0 }
        ]
      },
      bruceNumber: {
        value: Math.round(bruceNumber * 10) / 10,
        exact: Math.round(bruceNumber * 100) / 100,
        unit: "",
        label: "Bruce Number",
        sublabel: "(higher is faster)",
        category: this.classifyBruce(bruceNumber),
        barPercent: this.scaleToBar(bruceNumber, 0.9, 1.7),
        zones: [
          { name: "Slow", min: 0.9, max: 1.1 },
          { name: "Cruiser", min: 1.1, max: 1.25 },
          { name: "Performance", min: 1.25, max: 1.45 },
          { name: "Racer", min: 1.45, max: 1.7 }
        ]
      },
      kelsall: {
        value: Math.round(kelsallIndex * 10) / 10,
        exact: Math.round(kelsallIndex * 100) / 100,
        unit: "",
        label: "Kelsall",
        sublabel: "(higher is faster)",
        category: this.classifyKelsall(kelsallIndex),
        barPercent: this.scaleToBar(kelsallIndex, 0.5, 1.3),
        zones: [
          { name: "Slow", min: 0.5, max: 0.68 },
          { name: "Cruiser", min: 0.68, max: 0.85 },
          { name: "Performance", min: 0.85, max: 1.05 },
          { name: "Racer", min: 1.05, max: 1.3 }
        ]
      },
      saDisp: {
        value: Math.round(saDispRatio),
        exact: Math.round(saDispRatio * 10) / 10,
        unit: "",
        label: "Sail Area to Displacement",
        sublabel: "(higher is faster)",
        category: this.classifySaDisp(saDispRatio),
        barPercent: this.scaleToBar(saDispRatio, 15, 42),
        zones: [
          { name: "Slow", min: 15, max: 20 },
          { name: "Cruiser", min: 20, max: 25 },
          { name: "Performance", min: 25, max: 32 },
          { name: "Racer", min: 32, max: 42 }
        ]
      },
      dispLength: {
        value: Math.round(dispLengthRatio),
        exact: Math.round(dispLengthRatio * 10) / 10,
        unit: "",
        label: "Displacement to Length",
        sublabel: "(lower is faster)",
        category: this.classifyDispLength(dispLengthRatio),
        barPercent: 100 - this.scaleToBar(dispLengthRatio, 40, 220),
        zones: [
          { name: "Slow", min: 175, max: 220 },
          { name: "Cruiser", min: 125, max: 175 },
          { name: "Performance", min: 75, max: 125 },
          { name: "Racer", min: 40, max: 75 }
        ]
      }
    };

    return {
      metric: {
        loa: s.loa_m.toFixed(2) + " m",
        lwl: s.lwl_m.toFixed(2) + " m",
        boa: s.boa_m.toFixed(2) + " m",
        draft_min: s.draft_min_m.toFixed(2) + " m",
        draft_max: s.draft_max_m.toFixed(2) + " m",
        draft_display: s.draft_min_m === s.draft_max_m ? s.draft_min_m.toFixed(2) + " m" : `${s.draft_min_m.toFixed(2)} - ${s.draft_max_m.toFixed(2)} m`,
        displacement_light: s.displacement_light_t.toFixed(2) + " t",
        displacement_loaded: s.displacement_loaded_t.toFixed(2) + " t",
        payload_capacity: s.payload_capacity_kg ? s.payload_capacity_kg.toLocaleString() + " kg" : "N/A",
        sail_area_upwind: s.sail_area_upwind_m2.toFixed(1) + " m²",
        mainsail_area: s.mainsail_area_m2.toFixed(1) + " m²",
        genoa_area: s.genoa_area_m2.toFixed(1) + " m²",
        gennaker_area: s.gennaker_code0_m2 ? s.gennaker_code0_m2.toFixed(1) + " m²" : "N/A",
        mast_clearance: s.mast_clearance_m ? s.mast_clearance_m.toFixed(2) + " m" : "N/A",
        bridgedeck_clearance: s.bridgedeck_clearance_m ? (s.bridgedeck_clearance_m * 100).toFixed(0) + " cm" : "N/A",
        fuel: s.fuel_capacity_l + " L",
        water: s.water_capacity_l + " L",
        coreCategory: boat.coreCategory || "Balsa / Foam (Hull # dependent)",
        coreDetails: boat.coreDetails || boat.hullMaterial
      },
      imperial: {
        loa: loa_ft.toFixed(1) + " ft",
        lwl: lwl_ft.toFixed(1) + " ft",
        boa: boa_ft.toFixed(1) + " ft",
        draft_min: draft_min_ft.toFixed(1) + " ft",
        draft_max: draft_max_ft.toFixed(1) + " ft",
        draft_display: s.draft_min_m === s.draft_max_m ? draft_min_ft.toFixed(1) + " ft" : `${draft_min_ft.toFixed(1)} - ${draft_max_ft.toFixed(1)} ft`,
        displacement_light: Math.round(disp_light_lbs).toLocaleString() + " lbs",
        displacement_loaded: Math.round(disp_loaded_lbs).toLocaleString() + " lbs",
        payload_capacity: payload_lbs ? Math.round(payload_lbs).toLocaleString() + " lbs" : "N/A",
        sail_area_upwind: Math.round(sa_upwind_ft2).toLocaleString() + " sq ft",
        mainsail_area: Math.round(sa_main_ft2).toLocaleString() + " sq ft",
        genoa_area: Math.round(sa_genoa_ft2).toLocaleString() + " sq ft",
        gennaker_area: sa_gennaker_ft2 ? Math.round(sa_gennaker_ft2).toLocaleString() + " sq ft" : "N/A",
        mast_clearance: mast_clearance_ft ? mast_clearance_ft.toFixed(1) + " ft" : "N/A",
        bridgedeck_clearance: bridgedeck_ft ? bridgedeck_ft.toFixed(1) + " ft" : "N/A",
        fuel: Math.round(fuel_gal) + " US gal",
        water: Math.round(water_gal) + " US gal",
        coreCategory: boat.coreCategory || "Balsa / Foam (Hull # dependent)",
        coreDetails: boat.coreDetails || boat.hullMaterial
      },
      raw: {
        loa_m: s.loa_m,
        loa_ft: loa_ft,
        lwl_m: s.lwl_m,
        lwl_ft: lwl_ft,
        boa_m: s.boa_m,
        boa_ft: boa_ft,
        draft_min_m: s.draft_min_m,
        draft_max_m: s.draft_max_m,
        disp_light_t: s.displacement_light_t,
        disp_light_lbs: disp_light_lbs,
        sa_upwind_m2: s.sail_area_upwind_m2,
        sa_upwind_ft2: sa_upwind_ft2,
        bruceNumber: bruceNumber,
        kelsallIndex: kelsallIndex,
        saDispRatio: saDispRatio,
        dispLengthRatio: dispLengthRatio,
        estimatedBoatSpeed: estimatedBoatSpeed,
        sailPerformancePercent: sailPerformancePercent,
        hullSpeed: hullSpeed,
        beamLengthRatio: beamLengthRatio,
        bridgedeckRatio: bridgedeckRatio,
        maxPolar: maxPolar,
        upwindTarget: upwindTarget
      },
      indicators: indicators
    };
  },

  /**
   * Calculate absolute Maximum Speed across entire polar diagram
   */
  calculateMaxPolarSpeed(boat) {
    const p = boat.polars;
    const angles = [35, 45, 60, 90, 110, 135, 150, 180];
    const windSpeeds = [8, 12, 16, 20, 25];
    let maxSpeed = 0;
    let optTwa = 110;
    let optTws = 25;

    windSpeeds.forEach(tws => {
      const key = "tws" + tws;
      if (p[key]) {
        p[key].forEach((spd, idx) => {
          if (spd > maxSpeed) {
            maxSpeed = spd;
            optTwa = angles[idx];
            optTws = tws;
          }
        });
      }
    });

    return {
      maxSpeed: Math.round(maxSpeed * 10) / 10,
      twa: optTwa,
      tws: optTws
    };
  },

  /**
   * Calculate Optimal Upwind TWA and Best Upwind VMG
   */
  calculateOptimumUpwind(boat, tws) {
    const hasDaggerboards = boat.keelType.toLowerCase().includes('dagger');
    let bestTwa = hasDaggerboards ? 38 : 46;
    let bestVmg = 0;

    for (let testTwa = 30; testTwa <= 60; testTwa += 1) {
      const spd = this.predictBasePolarSpeed(boat, tws, testTwa);
      const leeway = this.calculateLeewayAngle(boat, tws, testTwa, spd, 28, tws * 1.3);
      const trackRad = ((testTwa + leeway) * Math.PI) / 180.0;
      const vmg = spd * Math.cos(trackRad);
      if (vmg > bestVmg) {
        bestVmg = vmg;
        bestTwa = testTwa;
      }
    }

    return {
      twa: bestTwa,
      vmg: Math.round(bestVmg * 10) / 10
    };
  },

  /**
   * Calculate hydrodynamic leeway drift angle (deg)
   */
  calculateLeewayAngle(boat, tws, twa, boatSpeed, awa, aws) {
    if (boatSpeed < 0.5) return 0;
    const hasDaggerboards = boat.keelType.toLowerCase().includes('dagger');
    const isTrimaran = boat.category.toLowerCase().includes('trimaran');

    let kFoil = 4.6;
    if (hasDaggerboards) kFoil = 1.9;
    else if (isTrimaran) kFoil = 2.8;

    const awaRad = ((awa || 40) * Math.PI) / 180.0;
    const speedRatio = (aws || tws) / Math.max(1.5, boatSpeed);
    
    let leeway = kFoil * Math.pow(speedRatio, 1.4) * Math.sin(awaRad) * 0.18;

    if (twa > 70) {
      leeway *= Math.max(0.05, Math.cos(((twa - 70) * Math.PI) / 220.0));
    }

    leeway = Math.max(0.2, Math.min(12.0, leeway));
    return Math.round(leeway * 10) / 10;
  },

  scaleToBar(val, min, max) {
    if (val <= min) return 5;
    if (val >= max) return 95;
    return Math.round(((val - min) / (max - min)) * 90 + 5);
  },

  classifySailPerf(val) {
    if (val < 62) return "Slow";
    if (val < 74) return "Cruiser";
    if (val < 90) return "Performance";
    return "Racer";
  },

  classifyBoatSpeed(val) {
    if (val < 9.8) return "Slow";
    if (val < 11.6) return "Cruiser";
    if (val < 14.2) return "Performance";
    return "Racer";
  },

  classifyBruce(val) {
    if (val < 1.1) return "Slow";
    if (val < 1.25) return "Cruiser";
    if (val < 1.45) return "Performance";
    return "Racer";
  },

  classifyKelsall(val) {
    if (val < 0.68) return "Slow";
    if (val < 0.85) return "Cruiser";
    if (val < 1.05) return "Performance";
    return "Racer";
  },

  classifySaDisp(val) {
    if (val < 20) return "Slow";
    if (val < 25) return "Cruiser";
    if (val < 32) return "Performance";
    return "Racer";
  },

  classifyDispLength(val) {
    if (val > 175) return "Slow";
    if (val > 125) return "Cruiser";
    if (val > 75) return "Performance";
    return "Racer";
  },

  /**
   * Predict base polar speed for boat at standard full sail configuration
   */
  predictBasePolarSpeed(boat, tws, twa) {
    const p = boat.polars;
    const angles = [35, 45, 60, 90, 110, 135, 150, 180];
    const windSpeeds = [8, 12, 16, 20, 25];

    let lowerTws = 8, upperTws = 12;
    let lowerKey = "tws8", upperKey = "tws12";
    if (tws <= 8) {
      lowerTws = 8; upperTws = 8; lowerKey = "tws8"; upperKey = "tws8";
    } else if (tws >= 25) {
      lowerTws = 25; upperTws = 25; lowerKey = "tws25"; upperKey = "tws25";
    } else {
      for (let i = 0; i < windSpeeds.length - 1; i++) {
        if (tws >= windSpeeds[i] && tws <= windSpeeds[i+1]) {
          lowerTws = windSpeeds[i];
          upperTws = windSpeeds[i+1];
          lowerKey = "tws" + lowerTws;
          upperKey = "tws" + upperTws;
          break;
        }
      }
    }

    const interpolateAngle = (curve, angle) => {
      if (angle <= angles[0]) return curve[0];
      if (angle >= angles[angles.length - 1]) return curve[curve.length - 1];
      for (let i = 0; i < angles.length - 1; i++) {
        if (angle >= angles[i] && angle <= angles[i+1]) {
          const ratio = (angle - angles[i]) / (angles[i+1] - angles[i]);
          return curve[i] + ratio * (curve[i+1] - curve[i]);
        }
      }
      return curve[0];
    };

    const spdLower = interpolateAngle(p[lowerKey], twa);
    const spdUpper = interpolateAngle(p[upperKey], twa);

    let speed;
    if (lowerTws === upperTws) {
      if (tws < 8) {
        speed = spdLower * Math.pow(tws / 8.0, 1.05);
      } else if (tws > 25) {
        speed = spdUpper * Math.pow(tws / 25.0, 0.45);
      } else {
        speed = spdLower;
      }
    } else {
      const twsRatio = (tws - lowerTws) / (upperTws - lowerTws);
      speed = spdLower + twsRatio * (spdUpper - spdLower);
    }

    return speed;
  },

  /**
   * Comprehensive VPP Simulation with Sails & Reefing Physics
   * @param {Object} boat Boat specification object
   * @param {Object} config Simulation conditions:
   *   - tws: True Wind Speed (kn)
   *   - twa: True Wind Angle (deg)
   *   - mainReef: 'full' (1.0) | 'reef1' (0.82) | 'reef2' (0.64) | 'reef3' (0.45) | 'none' (0.0)
   *   - headsailType: 'genoa' | 'solent' | 'gennaker' | 'spinnaker' | 'storm' | 'none'
   *   - headsailReef: 1.0 (100%), 0.75, 0.50, 0.25, 0.0 (furled)
   *   - payloadTons: additional cruising load in metric tons (e.g. 0 to 4.0)
   */
  simulateSailPerformance(boat, config) {
    const tws = Math.max(1, config.tws || 15);
    const twa = Math.max(25, Math.min(180, config.twa || 90));
    const payload = config.payloadTons || 0;

    // 1. Mainsail area fraction
    const mainReefMap = {
      'full': 1.0,
      'reef1': 0.82,
      'reef2': 0.64,
      'reef3': 0.45,
      'reef4': 0.25,
      'none': 0.0
    };
    const mainFrac = mainReefMap[config.mainReef || 'full'] ?? 1.0;

    // 2. Headsail Type Base Area Multiplier & Angle Suitability
    const headsailConfigMap = {
      'genoa': { name: 'Standard Genoa (110%)', areaRatio: 1.0, minTwa: 32, maxTwa: 155, optTwa: 50 },
      'solent': { name: 'Self-Tacking Jib / Solent', areaRatio: 0.82, minTwa: 28, maxTwa: 145, optTwa: 45 },
      'code0': { name: 'Code 0 Reaching Sail', areaRatio: 1.85, minTwa: 50, maxTwa: 135, optTwa: 85 },
      'coded': { name: 'Code D Furling Spinnaker', areaRatio: 2.10, minTwa: 75, maxTwa: 165, optTwa: 125 },
      'parasailor': { name: 'Parasailor (Winged Spinnaker)', areaRatio: 2.60, minTwa: 105, maxTwa: 180, optTwa: 150 },
      'spinnaker': { name: 'Asymmetrical Spinnaker', areaRatio: 2.35, minTwa: 105, maxTwa: 180, optTwa: 140 },
      'storm': { name: 'Storm Jib', areaRatio: 0.35, minTwa: 35, maxTwa: 180, optTwa: 60 },
      'none': { name: 'Furled (No Headsail)', areaRatio: 0.0, minTwa: 0, maxTwa: 180, optTwa: 90 }
    };

    const hsChoice = headsailConfigMap[config.headsailType || 'genoa'] || headsailConfigMap['genoa'];
    const hsReef = Math.max(0, Math.min(1.0, config.headsailReef !== undefined ? config.headsailReef : 1.0));
    const hsEffectiveFrac = hsChoice.areaRatio * hsReef;

    // 3. Compute active sail area vs standard design upwind sail area
    const stdMainArea = boat.specs.mainsail_area_m2;
    const stdGenoaArea = boat.specs.genoa_area_m2;
    const stdUpwindArea = boat.specs.sail_area_upwind_m2;

    const activeMainArea = stdMainArea * mainFrac;
    const activeHsArea = stdGenoaArea * hsEffectiveFrac;
    const activeTotalArea = activeMainArea + activeHsArea;

    // Active sail area ratio
    const sailPowerRatio = activeTotalArea / stdUpwindArea;

    // 4. Calculate Base Polar Speed at TWS & TWA
    const basePolarSpeed = this.predictBasePolarSpeed(boat, tws, twa);

    // 5. Sail Angle Efficiency based on aerodynamic sail profile
    let angleEfficiency = 1.0;
    if (config.headsailType === 'code0') {
      if (twa < 45) angleEfficiency = Math.max(0.2, (twa - 30) / 15.0);
      else if (twa > 140) angleEfficiency = 0.88;
    } else if (config.headsailType === 'coded') {
      if (twa < 65) angleEfficiency = Math.max(0.15, (twa - 45) / 20.0);
      else if (twa >= 90 && twa <= 150) angleEfficiency = 1.08;
    } else if (config.headsailType === 'parasailor') {
      if (twa < 95) angleEfficiency = Math.max(0.1, (twa - 75) / 20.0);
      else if (twa >= 120 && twa <= 180) angleEfficiency = 1.14; // Parasailor dynamic wing lift
    } else if (config.headsailType === 'spinnaker') {
      if (twa < 95) angleEfficiency = Math.max(0.1, (twa - 75) / 20.0);
      else if (twa >= 115 && twa <= 165) angleEfficiency = 1.10;
    } else if (config.headsailType === 'solent' || config.headsailType === 'genoa') {
      if (twa > 140) angleEfficiency = 0.88;
    }

    // 6. Hydrodynamic Loading / Payload effect
    const lightDisp = boat.specs.displacement_light_t;
    const loadFactor = Math.pow(lightDisp / (lightDisp + payload), 0.35);

    // 7. Overpowering / Heeling limits and Safety Thresholds
    let safetyStatus = "Optimal";
    let safetyNotice = "Sail configuration well balanced for conditions.";
    let powerReductionFactor = 1.0;

    const isHighWind = tws > 18;
    const isGale = tws >= 28;

    if (tws > 19 && mainFrac === 1.0 && twa < 120) {
      safetyStatus = "Overpowered";
      safetyNotice = "High rig loads & heel. Reef 1 recommended.";
      powerReductionFactor = 0.94;
    }
    if (tws > 25 && (mainFrac > 0.7 || hsEffectiveFrac > 1.0) && twa < 135) {
      safetyStatus = "Overpowered - Warning";
      safetyNotice = "Excessive rig loads! Depowering required (Reef 2 + Furling).";
      powerReductionFactor = 0.85;
    }
    if (isGale && (mainFrac > 0.5 || hsEffectiveFrac > 0.6)) {
      safetyStatus = "Hazardous Rig Load";
      safetyNotice = "Extreme gust capsize risk. Drop main to Reef 3 / Storm Jib!";
      powerReductionFactor = 0.70;
    }

    if (tws < 12 && sailPowerRatio < 0.75 && activeTotalArea > 0) {
      safetyStatus = "Under-canvassed";
      safetyNotice = "Underpowered for light wind. Shake out reefs or hoist Code 0.";
    }

    if (activeTotalArea === 0) {
      safetyStatus = "Bare Poles";
      safetyNotice = "No sails set. Drifting under windage only.";
    }

    // 8. Dynamic Speed Calculation
    let boatSpeed = 0;
    if (activeTotalArea > 0) {
      const powerScaling = Math.pow(Math.max(0.05, sailPowerRatio), 0.42);
      boatSpeed = basePolarSpeed * powerScaling * angleEfficiency * loadFactor * powerReductionFactor;
    } else {
      boatSpeed = Math.min(2.5, tws * 0.08);
    }

    boatSpeed = Math.round(boatSpeed * 10) / 10;

    // 9. Apparent Wind Speed (AWS) & Apparent Wind Angle (AWA)
    const twaRad = (twa * Math.PI) / 180.0;
    const vx = tws * Math.cos(twaRad) + boatSpeed;
    const vy = tws * Math.sin(twaRad);
    const aws = Math.round(Math.sqrt(vx * vx + vy * vy) * 10) / 10;
    let awa = Math.round((Math.atan2(vy, vx) * 180.0) / Math.PI);
    if (awa < 0) awa += 360;

    // 10. Hydrodynamic Leeway & Ground Track
    const leewayAngle = this.calculateLeewayAngle(boat, tws, twa, boatSpeed, awa, aws);
    const trackAngleRelWind = Math.round((twa + leewayAngle) * 10) / 10;

    // 11. Velocity Made Good (VMG) incorporating leeway track
    const trackRad = (trackAngleRelWind * Math.PI) / 180.0;
    const upwindVmg = Math.round(boatSpeed * Math.cos(trackRad) * 10) / 10;
    const downwindVmg = Math.round(boatSpeed * Math.cos(Math.PI - trackRad) * 10) / 10;

    // 12. Maximum Speed info for boat
    const maxPolar = this.calculateMaxPolarSpeed(boat);

    // 13. Point of Sail Description
    let pointOfSail = "Beam Reach";
    if (twa < 40) pointOfSail = "Close Hauled (Beating)";
    else if (twa < 60) pointOfSail = "Close Reach";
    else if (twa <= 110) pointOfSail = "Beam Reach";
    else if (twa <= 145) pointOfSail = "Broad Reach";
    else if (twa <= 165) pointOfSail = "Deep Broad Reach";
    else pointOfSail = "Dead Run (Running)";

    return {
      boatSpeed: boatSpeed,
      aws: aws,
      awa: awa,
      tws: tws,
      twa: twa,
      leewayAngle: leewayAngle,
      trackAngleRelWind: trackAngleRelWind,
      upwindVmg: upwindVmg,
      downwindVmg: downwindVmg,
      pointOfSail: pointOfSail,
      sailPerformancePercent: Math.round((boatSpeed / tws) * 100),
      activeTotalArea: Math.round(activeTotalArea * 10) / 10,
      activeMainArea: Math.round(activeMainArea * 10) / 10,
      activeHsArea: Math.round(activeHsArea * 10) / 10,
      sailPowerRatioPercent: Math.round(sailPowerRatio * 100),
      maxPolarSpeed: maxPolar.maxSpeed,
      maxPolarTwa: maxPolar.twa,
      maxPolarTws: maxPolar.tws,
      safetyStatus: safetyStatus,
      safetyNotice: safetyNotice
    };
  },

  /**
   * Predict boat speed for standard polar chart without custom simulator config
   */
  predictBoatSpeed(boat, tws, twa) {
    return Math.round(this.predictBasePolarSpeed(boat, tws, twa) * 10) / 10;
  }
};
