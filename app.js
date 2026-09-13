/**
 * Main Application Logic for Catamaran Performance Comparator
 */

(function () {
  'use strict';

  // Application State
  const state = {
    boats: [null, null, null],
    unit: 'metric', // 'metric' | 'imperial'
    activeTab: 'indicators',
    selectedPolarTws: 16, // 8, 12, 16, 20, 25, or 'all'
    polarMaxSpeed: 25, // Zoomable polar speed scale (12 to 50 kn)
    radarZoom: 1.0, // Zoomable radar scale (0.6 to 1.8)
    sim: {
      tws: 16,
      twa: 90,
      mainReef: 'full',
      headsailType: 'genoa',
      headsailReef: 1.0,
      payloadTons: 1.5
    }
  };

  // DOM Elements
  const elements = {
    select1: document.getElementById('boatSelect1'),
    select2: document.getElementById('boatSelect2'),
    select3: document.getElementById('boatSelect3'),
    unitMetricBtn: document.getElementById('unitMetricBtn'),
    unitImperialBtn: document.getElementById('unitImperialBtn'),
    btnShare: document.getElementById('btnShare'),
    btnPrint: document.getElementById('btnPrint'),
    heroCardsContainer: document.getElementById('heroCardsContainer'),
    indicatorsContainer: document.getElementById('indicatorsContainer'),
    specsTableBody: document.getElementById('specsTableBody'),
    specsBoatHeader1: document.getElementById('specsBoatHeader1'),
    specsBoatHeader2: document.getElementById('specsBoatHeader2'),
    specsBoatHeader3: document.getElementById('specsBoatHeader3'),
    polarCanvas: document.getElementById('polarCanvas'),
    radarCanvas: document.getElementById('radarCanvas'),
    compassCanvas: document.getElementById('compassCanvas'),
    pointOfSailBadge: document.getElementById('pointOfSailBadge'),
    twsPillsContainer: document.getElementById('twsPillsContainer'),
    
    // Zoom Controls
    polarZoomInBtn: document.getElementById('polarZoomInBtn'),
    polarZoomOutBtn: document.getElementById('polarZoomOutBtn'),
    polarZoomResetBtn: document.getElementById('polarZoomResetBtn'),
    radarZoomInBtn: document.getElementById('radarZoomInBtn'),
    radarZoomOutBtn: document.getElementById('radarZoomOutBtn'),
    radarZoomResetBtn: document.getElementById('radarZoomResetBtn'),
    polarLegendText1: document.getElementById('polarLegendText1'),
    polarLegendText2: document.getElementById('polarLegendText2'),
    polarLegendText3: document.getElementById('polarLegendText3'),

    // Simulator Controls
    simTwsInput: document.getElementById('simTwsInput'),
    simTwaInput: document.getElementById('simTwaInput'),
    simTwsVal: document.getElementById('simTwsVal'),
    simTwaVal: document.getElementById('simTwaVal'),
    simMainReefSelect: document.getElementById('simMainReefSelect'),
    simHeadsailTypeSelect: document.getElementById('simHeadsailTypeSelect'),
    simHeadsailReefSelect: document.getElementById('simHeadsailReefSelect'),
    simPayloadSelect: document.getElementById('simPayloadSelect'),
    simMainReefDesc: document.getElementById('simMainReefDesc'),
    simHeadsailDesc: document.getElementById('simHeadsailDesc'),
    simHeadsailReefDesc: document.getElementById('simHeadsailReefDesc'),
    simPayloadDesc: document.getElementById('simPayloadDesc'),
    simResultsContainer: document.getElementById('simResultsContainer'),
    
    toast: document.getElementById('toastNotice'),
    tabNavBtns: document.querySelectorAll('.tab-nav-btn'),
    tabPanes: document.querySelectorAll('.tab-pane')
  };

  /**
   * Initialize App
   */
  function init() {
    populateDropdowns();
    parseUrlParams();
    setupEventListeners();
    updateAll();
  }

  /**
   * Populate select dropdowns with available catamaran models
   */
  function populateDropdowns() {
    const selects = [elements.select1, elements.select2, elements.select3];
    
    // Group boats by manufacturer
    const grouped = {};
    CATAMARAN_DATABASE.forEach(boat => {
      if (!grouped[boat.manufacturer]) {
        grouped[boat.manufacturer] = [];
      }
      grouped[boat.manufacturer].push(boat);
    });

    selects.forEach(select => {
      select.innerHTML = '';
      for (const [manufacturer, boats] of Object.entries(grouped)) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = manufacturer;
        boats.forEach(boat => {
          const option = document.createElement('option');
          option.value = boat.id;
          option.textContent = `${boat.manufacturer} ${boat.name}`;
          optgroup.appendChild(option);
        });
        select.appendChild(optgroup);
      }
    });
  }

  /**
   * Parse URL Query parameters
   */
  function parseUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const key1 = params.get('key1');
    const key2 = params.get('key2');
    const key3 = params.get('key3');
    const unitParam = params.get('unit');

    if (unitParam === 'imperial' || unitParam === 'metric') {
      state.unit = unitParam;
    }

    state.boats[0] = findBoatByKeyOrId(key1) || CATAMARAN_DATABASE.find(b => b.id === 'fp-elba-45') || CATAMARAN_DATABASE[0];
    state.boats[1] = findBoatByKeyOrId(key2) || CATAMARAN_DATABASE.find(b => b.id === 'fp-tanna-47') || CATAMARAN_DATABASE[1];
    state.boats[2] = findBoatByKeyOrId(key3) || CATAMARAN_DATABASE.find(b => b.id === 'fp-aura-51') || CATAMARAN_DATABASE[2];

    elements.select1.value = state.boats[0].id;
    elements.select2.value = state.boats[1].id;
    elements.select3.value = state.boats[2].id;

    updateUnitButtons();
  }

  /**
   * Find boat by exact key or id or fuzzy match
   */
  function findBoatByKeyOrId(query) {
    if (!query) return null;
    const cleanQ = query.trim().toLowerCase().replace(/[\s\-_+]+/g, ' ');
    return CATAMARAN_DATABASE.find(b => {
      const bKey = (b.key || '').toLowerCase().replace(/[\s\-_+]+/g, ' ');
      const bName = (b.name || '').toLowerCase().replace(/[\s\-_+]+/g, ' ');
      const bId = (b.id || '').toLowerCase();
      return bKey.includes(cleanQ) || cleanQ.includes(bKey) || bName.includes(cleanQ) || bId === cleanQ;
    });
  }

  /**
   * Update URL parameters to allow bookmarking / sharing
   */
  function syncUrlParams() {
    const params = new URLSearchParams();
    if (state.boats[0]) params.set('key1', state.boats[0].key || state.boats[0].name);
    if (state.boats[1]) params.set('key2', state.boats[1].key || state.boats[1].name);
    if (state.boats[2]) params.set('key3', state.boats[2].key || state.boats[2].name);
    if (state.unit !== 'metric') params.set('unit', state.unit);
    
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }

  /**
   * Setup Event Listeners
   */
  function setupEventListeners() {
    elements.select1.addEventListener('change', (e) => {
      state.boats[0] = CATAMARAN_DATABASE.find(b => b.id === e.target.value);
      updateAll();
    });

    elements.select2.addEventListener('change', (e) => {
      state.boats[1] = CATAMARAN_DATABASE.find(b => b.id === e.target.value);
      updateAll();
    });

    elements.select3.addEventListener('change', (e) => {
      state.boats[2] = CATAMARAN_DATABASE.find(b => b.id === e.target.value);
      updateAll();
    });

    elements.unitMetricBtn.addEventListener('click', () => {
      state.unit = 'metric';
      updateUnitButtons();
      updateAll();
    });

    elements.unitImperialBtn.addEventListener('click', () => {
      state.unit = 'imperial';
      updateUnitButtons();
      updateAll();
    });

    elements.btnShare.addEventListener('click', () => {
      navigator.clipboard.writeText(window.location.href).then(() => {
        showToast('Link copied to clipboard!');
      }).catch(() => {
        showToast('Share URL: ' + window.location.href);
      });
    });

    elements.btnPrint.addEventListener('click', () => {
      window.print();
    });

    // Zoom Controls
    if (elements.polarZoomInBtn) {
      elements.polarZoomInBtn.addEventListener('click', () => {
        state.polarMaxSpeed = Math.max(12, state.polarMaxSpeed - 4);
        renderPolarChart();
        showToast(`Polar Scale: ${state.polarMaxSpeed} kn max`);
      });
    }
    if (elements.polarZoomOutBtn) {
      elements.polarZoomOutBtn.addEventListener('click', () => {
        state.polarMaxSpeed = Math.min(60, state.polarMaxSpeed + 5);
        renderPolarChart();
        showToast(`Polar Scale: ${state.polarMaxSpeed} kn max`);
      });
    }
    if (elements.polarZoomResetBtn) {
      elements.polarZoomResetBtn.addEventListener('click', () => {
        state.polarMaxSpeed = 25;
        renderPolarChart();
        showToast('Polar Zoom Reset (25 kn)');
      });
    }

    if (elements.radarZoomInBtn) {
      elements.radarZoomInBtn.addEventListener('click', () => {
        state.radarZoom = Math.min(1.8, state.radarZoom + 0.2);
        renderRadarChart();
      });
    }
    if (elements.radarZoomOutBtn) {
      elements.radarZoomOutBtn.addEventListener('click', () => {
        state.radarZoom = Math.max(0.5, state.radarZoom - 0.2);
        renderRadarChart();
      });
    }
    if (elements.radarZoomResetBtn) {
      elements.radarZoomResetBtn.addEventListener('click', () => {
        state.radarZoom = 1.0;
        renderRadarChart();
        showToast('Radar Zoom Reset');
      });
    }

    // Tab Navigation
    elements.tabNavBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        elements.tabNavBtns.forEach(b => b.classList.remove('active'));
        elements.tabPanes.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-tab');
        const targetPane = document.getElementById(targetId);
        if (targetPane) targetPane.classList.add('active');
        state.activeTab = targetId;

        if (targetId === 'tabPolars') {
          renderPolarChart();
          renderRadarChart();
        } else if (targetId === 'tabSimulator') {
          renderCompassVector();
        }
      });
    });

    // TWS Pills
    elements.twsPillsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('tws-pill')) {
        document.querySelectorAll('.tws-pill').forEach(p => p.classList.remove('active'));
        e.target.classList.add('active');
        const twsVal = e.target.getAttribute('data-tws');
        state.selectedPolarTws = twsVal === 'all' ? 'all' : parseInt(twsVal, 10);
        renderPolarChart();
      }
    });

    // VPP Simulator Sliders & Controls
    elements.simTwsInput.addEventListener('input', (e) => {
      state.sim.tws = parseInt(e.target.value, 10);
      elements.simTwsVal.textContent = state.sim.tws + ' kn';
      updatePresetTwsButtons(state.sim.tws);
      updateVppSimulator();
    });

    // TWS Presets
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.getAttribute('data-tws'), 10);
        state.sim.tws = val;
        elements.simTwsInput.value = val;
        elements.simTwsVal.textContent = val + ' kn';
        updatePresetTwsButtons(val);
        updateVppSimulator();
      });
    });

    elements.simTwaInput.addEventListener('input', (e) => {
      state.sim.twa = parseInt(e.target.value, 10);
      updateTwaDisplay();
      updatePresetTwaButtons(state.sim.twa);
      updateVppSimulator();
    });

    // TWA Presets
    document.querySelectorAll('.preset-twa-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.getAttribute('data-twa'), 10);
        state.sim.twa = val;
        elements.simTwaInput.value = val;
        updateTwaDisplay();
        updatePresetTwaButtons(val);
        updateVppSimulator();
      });
    });

    // Sail Config Selects
    elements.simMainReefSelect.addEventListener('change', (e) => {
      state.sim.mainReef = e.target.value;
      const descMap = {
        'full': 'Full Mainsail (100% Area)',
        'reef1': 'Reef 1 (82% Area)',
        'reef2': 'Reef 2 (64% Area)',
        'reef3': 'Reef 3 (45% Area)',
        'none': 'Furled / Dropped (0% Area)'
      };
      if (elements.simMainReefDesc) elements.simMainReefDesc.textContent = descMap[state.sim.mainReef] || '';
      updateVppSimulator();
    });

    elements.simHeadsailTypeSelect.addEventListener('change', (e) => {
      state.sim.headsailType = e.target.value;
      const descMap = {
        'genoa': 'Standard Overlapping Genoa (110%)',
        'solent': 'Self-Tacking Solent / Jib (82%)',
        'gennaker': 'Code 0 / Gennaker / Screecher (185%)',
        'spinnaker': 'Asymmetrical Spinnaker (230%)',
        'storm': 'Heavy Weather Storm Jib (35%)',
        'none': 'Furled / Dropped (0%)'
      };
      if (elements.simHeadsailDesc) elements.simHeadsailDesc.textContent = descMap[state.sim.headsailType] || '';
      updateVppSimulator();
    });

    elements.simHeadsailReefSelect.addEventListener('change', (e) => {
      state.sim.headsailReef = parseFloat(e.target.value);
      const descMap = {
        '1.0': '100% - Fully Deployed',
        '0.75': '75% - 1st Furling Mark',
        '0.50': '50% - Half Furled',
        '0.25': '25% - Heavy Furled',
        '0.0': '0% - Fully Furled'
      };
      if (elements.simHeadsailReefDesc) elements.simHeadsailReefDesc.textContent = descMap[e.target.value] || '';
      updateVppSimulator();
    });

    elements.simPayloadSelect.addEventListener('change', (e) => {
      state.sim.payloadTons = parseFloat(e.target.value);
      const descMap = {
        '0': '+0 kg Lightship',
        '1.5': '+1,500 kg Normal Cruising',
        '3.0': '+3,000 kg Liveaboard Passage',
        '4.5': '+4,500 kg Expedition'
      };
      if (elements.simPayloadDesc) elements.simPayloadDesc.textContent = descMap[e.target.value] || '';
      updateVppSimulator();
    });

    window.addEventListener('resize', () => {
      renderPolarChart();
      renderRadarChart();
      renderCompassVector();
    });
  }

  function updateTwsDisplay() {
    const tws = state.sim.tws;
    let desc = "Moderate Breeze";
    if (tws <= 5) desc = "Light Air";
    else if (tws <= 10) desc = "Light Breeze";
    else if (tws <= 15) desc = "Moderate";
    else if (tws <= 21) desc = "Fresh Breeze";
    else if (tws <= 27) desc = "Strong Breeze";
    else if (tws <= 33) desc = "Near Gale";
    else if (tws <= 40) desc = "Gale Force";
    else if (tws <= 47) desc = "Strong Gale";
    else if (tws <= 55) desc = "Storm (Beaufort 10)";
    else if (tws <= 63) desc = "Violent Storm (Beaufort 11)";
    else desc = "Hurricane Force (Beaufort 12+)";

    elements.simTwsVal.textContent = `${tws} kn ${desc}`;
  }

  function updateTwaDisplay() {
    const twa = state.sim.twa;
    let pos = "Beam Reach";
    if (twa < 40) pos = "Close Hauled (Beating)";
    else if (twa < 60) pos = "Close Reach";
    else if (twa <= 110) pos = "Beam Reach";
    else if (twa <= 145) pos = "Broad Reach";
    else if (twa <= 165) pos = "Deep Broad Reach";
    else pos = "Dead Run (Running)";

    elements.simTwaVal.textContent = `${twa}° ${pos}`;
    if (elements.pointOfSailBadge) elements.pointOfSailBadge.textContent = pos;
  }

  function updatePresetTwsButtons(val) {
    document.querySelectorAll('.preset-btn').forEach(btn => {
      if (parseInt(btn.getAttribute('data-tws'), 10) === val) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    updateTwsDisplay();
  }

  function updatePresetTwaButtons(val) {
    document.querySelectorAll('.preset-twa-btn').forEach(btn => {
      if (parseInt(btn.getAttribute('data-twa'), 10) === val) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function updateUnitButtons() {
    if (state.unit === 'metric') {
      elements.unitMetricBtn.classList.add('active');
      elements.unitImperialBtn.classList.remove('active');
    } else {
      elements.unitImperialBtn.classList.add('active');
      elements.unitMetricBtn.classList.remove('active');
    }
  }

  function showToast(msg) {
    elements.toast.textContent = msg;
    elements.toast.classList.add('show');
    setTimeout(() => {
      elements.toast.classList.remove('show');
    }, 3000);
  }

  /**
   * Main Master Render
   */
  function updateAll() {
    syncUrlParams();
    renderHeroCards();
    renderPerformanceIndicators();
    renderSpecificationsTable();
    renderPolarChart();
    renderRadarChart();
    updateVppSimulator();
  }

  /**
   * Render Top 3 Hero Cards
   */
  function renderHeroCards() {
    const isMetric = state.unit === 'metric';
    elements.heroCardsContainer.innerHTML = '';

    state.boats.forEach((boat, index) => {
      if (!boat) return;
      const bIdx = index + 1;
      const metrics = NAVAL_MATH.calculateBoatMetrics(boat);
      const u = isMetric ? metrics.metric : metrics.imperial;
      const coreBadge = boat.coreCategory || "Balsa / Foam";
      const marketPrice = boat.avgMarketPrice || boat.priceEstimate || "Contact Dealer";

      const card = document.createElement('div');
      card.className = `boat-hero-card boat${bIdx}`;
      card.innerHTML = `
        <div class="boat-hero-img-wrap">
          <img src="${boat.image}" alt="${boat.manufacturer} ${boat.name}" class="boat-hero-img" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1540946485063-a40da27545f8?auto=format&fit=crop&w=1000&q=80'" />
          <span class="boat-category-badge">${boat.category}</span>
        </div>
        <div class="boat-hero-body">
          <div class="boat-builder-name">${boat.manufacturer} • ${boat.year}</div>
          <h2 class="boat-model-name">${boat.name}</h2>
          
          <!-- Core Construction & Market Price Chips -->
          <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.75rem;">
            <span style="font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3);">
              📦 ${coreBadge}
            </span>
            <span style="font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3);">
              💰 ${marketPrice}
            </span>
          </div>

          <div class="hero-stats-banner">
            <div class="hero-stat-item">
              <div class="hero-stat-label">Max Speed (Polar)</div>
              <div class="hero-stat-val" style="color: var(--boat${bIdx}-color)">
                ${metrics.raw.maxPolar.maxSpeed}<span> kn</span>
              </div>
              <small style="font-size: 0.68rem; color: #94a3b8;">@ ${metrics.raw.maxPolar.twa}° in ${metrics.raw.maxPolar.tws}kn</small>
            </div>
            <div class="hero-stat-item">
              <div class="hero-stat-label">Best Upwind VMG</div>
              <div class="hero-stat-val">
                ${metrics.raw.upwindTarget.vmg}<span> kn</span>
              </div>
              <small style="font-size: 0.68rem; color: #94a3b8;">@ ${metrics.raw.upwindTarget.twa}° TWA</small>
            </div>
          </div>

          <div class="hero-quick-specs">
            <div class="quick-spec-row">
              <span class="spec-name">LOA / Length</span>
              <span class="spec-val">${u.loa}</span>
            </div>
            <div class="quick-spec-row">
              <span class="spec-name">Beam</span>
              <span class="spec-val">${u.boa}</span>
            </div>
            <div class="quick-spec-row">
              <span class="spec-name">Light Disp.</span>
              <span class="spec-val">${u.displacement_light}</span>
            </div>
            <div class="quick-spec-row">
              <span class="spec-name">Upwind Sail</span>
              <span class="spec-val">${u.sail_area_upwind}</span>
            </div>
          </div>
        </div>
      `;
      elements.heroCardsContainer.appendChild(card);
    });
  }

  /**
   * Render Performance Indicator Rows
   */
  function renderPerformanceIndicators() {
    elements.indicatorsContainer.innerHTML = '';
    
    const indicatorKeys = [
      'sailPerf',
      'boatSpeed',
      'maxSpeed',
      'bruceNumber',
      'kelsall',
      'saDisp',
      'dispLength'
    ];

    const allMetrics = state.boats.map(b => b ? NAVAL_MATH.calculateBoatMetrics(b) : null);

    indicatorKeys.forEach(key => {
      const sampleInd = allMetrics[0].indicators[key];
      const rowCard = document.createElement('div');
      rowCard.className = 'indicator-row-card';

      let boatsHtml = '';
      allMetrics.forEach((m, idx) => {
        if (!m) return;
        const bIdx = idx + 1;
        const ind = m.indicators[key];
        const boat = state.boats[idx];

        boatsHtml += `
          <div class="indicator-boat-item">
            <div class="indicator-boat-name boat${bIdx}">
              <span>${boat.manufacturer} ${boat.name}</span>
              <span class="category-chip ${ind.category}">${ind.category}</span>
            </div>
            
            <div class="indicator-value-box">
              <div class="indicator-value-num" style="color: var(--boat${bIdx}-color)">${ind.value}</div>
              <div class="indicator-value-unit">${ind.unit}</div>
            </div>

            <div class="zone-meter">
              <div class="zone-bar-track">
                <div class="zone-segment slow" title="Slow"></div>
                <div class="zone-segment cruiser" title="Cruiser"></div>
                <div class="zone-segment performance" title="Performance"></div>
                <div class="zone-segment racer" title="Racer"></div>
                <div class="zone-marker-pin" style="left: ${ind.barPercent}%" title="${ind.value} ${ind.unit}"></div>
              </div>
              <div class="zone-labels">
                <span>Slow</span>
                <span>Cruiser</span>
                <span>Performance</span>
                <span>Racer</span>
              </div>
            </div>
          </div>
        `;
      });

      rowCard.innerHTML = `
        <div class="indicator-header">
          <div class="indicator-title-group">
            <h3>${sampleInd.label}</h3>
            <p>${sampleInd.sublabel}</p>
          </div>
        </div>
        <div class="indicator-boats-grid">
          ${boatsHtml}
        </div>
      `;
      elements.indicatorsContainer.appendChild(rowCard);
    });
  }

  /**
   * Render Technical Specifications Table
   */
  function renderSpecificationsTable() {
    const isMetric = state.unit === 'metric';
    const allMetrics = state.boats.map(b => b ? NAVAL_MATH.calculateBoatMetrics(b) : null);

    elements.specsBoatHeader1.textContent = state.boats[0] ? `${state.boats[0].manufacturer} ${state.boats[0].name}` : 'Boat 1';
    elements.specsBoatHeader2.textContent = state.boats[1] ? `${state.boats[1].manufacturer} ${state.boats[1].name}` : 'Boat 2';
    elements.specsBoatHeader3.textContent = state.boats[2] ? `${state.boats[2].manufacturer} ${state.boats[2].name}` : 'Boat 3';

    const categories = [
      {
        name: "Dimensions & Hull Geometry",
        rows: [
          { label: "Length Overall (LOA)", getVal: (m, b) => isMetric ? m.metric.loa : m.imperial.loa },
          { label: "Length Waterline (LWL)", getVal: (m, b) => isMetric ? m.metric.lwl : m.imperial.lwl },
          { label: "Beam (BOA)", getVal: (m, b) => isMetric ? m.metric.boa : m.imperial.boa },
          { label: "Draft (Min / Max)", getVal: (m, b) => isMetric ? m.metric.draft_display : m.imperial.draft_display },
          { label: "Mast Clearance (Air Draft)", getVal: (m, b) => isMetric ? m.metric.mast_clearance : m.imperial.mast_clearance },
          { label: "Bridgedeck Clearance", getVal: (m, b) => isMetric ? m.metric.bridgedeck_clearance : m.imperial.bridgedeck_clearance },
        ]
      },
      {
        name: "Displacement & Ratios",
        rows: [
          { label: "Displacement (Light)", getVal: (m, b) => isMetric ? m.metric.displacement_light : m.imperial.displacement_light },
          { label: "Displacement (Loaded)", getVal: (m, b) => isMetric ? m.metric.displacement_loaded : m.imperial.displacement_loaded },
          { label: "Payload Capacity", getVal: (m, b) => isMetric ? m.metric.payload_capacity : m.imperial.payload_capacity },
          { label: "Max Speed (Polar Target)", getVal: (m, b) => `${m.raw.maxPolar.maxSpeed} kn (@ ${m.raw.maxPolar.twa}° in ${m.raw.maxPolar.tws}kn wind)` },
          { label: "Best Upwind Tack & VMG", getVal: (m, b) => `${m.raw.upwindTarget.twa}° TWA (VMG ${m.raw.upwindTarget.vmg} kn, Leeway ~${NAVAL_MATH.calculateLeewayAngle(b, 15, m.raw.upwindTarget.twa, m.raw.estimatedBoatSpeed, 30, 18)}°)` },
          { label: "Bruce Number", getVal: (m, b) => m.raw.bruceNumber.toFixed(2) },
          { label: "Kelsall Index", getVal: (m, b) => m.raw.kelsallIndex.toFixed(2) },
          { label: "Sail Area / Displacement (SA/D)", getVal: (m, b) => m.raw.saDispRatio.toFixed(1) },
          { label: "Displacement / Length (D/L)", getVal: (m, b) => Math.round(m.raw.dispLengthRatio) },
        ]
      },
      {
        name: "Sail Plan & Rigging",
        rows: [
          { label: "Upwind Sail Area (Main + Jib)", getVal: (m, b) => isMetric ? m.metric.sail_area_upwind : m.imperial.sail_area_upwind },
          { label: "Mainsail Area", getVal: (m, b) => isMetric ? m.metric.mainsail_area : m.imperial.mainsail_area },
          { label: "Genoa / Jib Area", getVal: (m, b) => isMetric ? m.metric.genoa_area : m.imperial.genoa_area },
          { label: "Gennaker / Code 0", getVal: (m, b) => isMetric ? m.metric.gennaker_area : m.imperial.gennaker_area },
        ]
      },
      {
        name: "Capacities & Tankage",
        rows: [
          { label: "Fuel Capacity", getVal: (m, b) => isMetric ? m.metric.fuel : m.imperial.fuel },
          { label: "Fresh Water Capacity", getVal: (m, b) => isMetric ? m.metric.water : m.imperial.water },
        ]
      },
      {
        name: "Accommodations",
        rows: [
          { label: "Cabins Layouts", getVal: (m, b) => b.specs.cabins || "N/A" },
          { label: "Berths", getVal: (m, b) => b.specs.berths || "N/A" },
          { label: "Heads / Bathrooms", getVal: (m, b) => b.specs.heads || "N/A" },
        ]
      },
      {
        name: "Design, Construction & Market Value",
        rows: [
          { label: "Core Material Classification", getVal: (m, b) => b.coreCategory || "Balsa / Foam (Hull # dependent)" },
          { label: "Hull & Deck Core Details", getVal: (m, b) => b.coreDetails || b.hullMaterial },
          { label: "Avg YachtWorld Market Price", getVal: (m, b) => b.avgMarketPrice || b.priceEstimate },
          { label: "Naval Architect / Designer", getVal: (m, b) => b.designer },
          { label: "Interior Designer", getVal: (m, b) => b.interiorDesigner || b.designer },
          { label: "Keel / Appendage Type", getVal: (m, b) => b.keelType },
          { label: "Helm Station Configuration", getVal: (m, b) => b.helmType },
          { label: "Steering Mechanism", getVal: (m, b) => b.steering || "Direct Linkage" },
          { label: "Standard Engines", getVal: (m, b) => b.engines },
          { label: "CE Ocean Category", getVal: (m, b) => b.ceCategory },
          { label: "Production Years", getVal: (m, b) => b.year },
        ]
      }
    ];

    let tbodyHtml = '';
    categories.forEach(cat => {
      tbodyHtml += `
        <tr class="category-header-row">
          <td colspan="4">${cat.name}</td>
        </tr>
      `;
      cat.rows.forEach(r => {
        const val1 = state.boats[0] ? r.getVal(allMetrics[0], state.boats[0]) : '-';
        const val2 = state.boats[1] ? r.getVal(allMetrics[1], state.boats[1]) : '-';
        const val3 = state.boats[2] ? r.getVal(allMetrics[2], state.boats[2]) : '-';

        tbodyHtml += `
          <tr>
            <td class="property-name">${r.label}</td>
            <td class="property-val boat1-col">${val1}</td>
            <td class="property-val boat2-col">${val2}</td>
            <td class="property-val boat3-col">${val3}</td>
          </tr>
        `;
      });
    });

    elements.specsTableBody.innerHTML = tbodyHtml;
  }

  /**
   * Render Interactive Polar Diagram on HTML5 Canvas (Zoomable & Dynamic Labels)
   */
  function renderPolarChart() {
    const canvas = elements.polarCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const centerX = width / 2;
    const centerY = height * 0.90;
    const maxRadius = Math.min(width * 0.43, height * 0.80);
    const maxSpeedScale = state.polarMaxSpeed || 25;

    // Update Polar Legend Labels with exact model names and size
    if (elements.polarLegendText1) {
      elements.polarLegendText1.textContent = state.boats[0] ? `${state.boats[0].name} (${state.boats[0].specs.loa_m}m / ${Math.round(state.boats[0].specs.loa_m * 3.28)}ft)` : 'Boat 1';
    }
    if (elements.polarLegendText2) {
      elements.polarLegendText2.textContent = state.boats[1] ? `${state.boats[1].name} (${state.boats[1].specs.loa_m}m / ${Math.round(state.boats[1].specs.loa_m * 3.28)}ft)` : 'Boat 2';
    }
    if (elements.polarLegendText3) {
      elements.polarLegendText3.textContent = state.boats[2] ? `${state.boats[2].name} (${state.boats[2].specs.loa_m}m / ${Math.round(state.boats[2].specs.loa_m * 3.28)}ft)` : 'Boat 3';
    }

    ctx.clearRect(0, 0, width, height);

    // 1. Draw Background Polar Grid Rings based on current zoom scale
    const ringStep = maxSpeedScale <= 16 ? 2 : (maxSpeedScale <= 30 ? 5 : 10);
    const speedRings = [];
    for (let s = ringStep; s <= maxSpeedScale; s += ringStep) {
      speedRings.push(s);
    }

    speedRings.forEach(spd => {
      const r = (spd / maxSpeedScale) * maxRadius;
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, Math.PI, 2 * Math.PI, false);
      ctx.strokeStyle = spd % 10 === 0 ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = spd % 10 === 0 ? 1.5 : 1;
      ctx.setLineDash(spd % 10 === 0 ? [] : [4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      drawPillBadge(ctx, centerX - r, centerY, `${spd} kn`, '#0f172a', '#38bdf8', '#0284c7');
      drawPillBadge(ctx, centerX + r, centerY, `${spd} kn`, '#0f172a', '#38bdf8', '#0284c7');
    });

    // 2. Draw Angle Radial Guidelines & High-Contrast Angle Badges
    const angles = [30, 45, 60, 90, 110, 135, 150, 180];
    angles.forEach(deg => {
      const rad = (deg - 90) * (Math.PI / 180);
      const x = centerX + maxRadius * Math.cos(rad);
      const y = centerY + maxRadius * Math.sin(rad);

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = deg === 90 ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = deg === 90 ? 1.8 : 1;
      ctx.stroke();

      const labelX = centerX + (maxRadius + 18) * Math.cos(rad);
      const labelY = centerY + (maxRadius + 18) * Math.sin(rad);
      drawPillBadge(ctx, labelX, labelY, `${deg}°`, '#1e293b', '#f8fafc', '#475569');
    });

    drawPillBadge(ctx, centerX, centerY - maxRadius - 22, '▲ TRUE WIND 000° (TWS)', '#0284c7', '#ffffff', '#38bdf8', true);

    // 3. Draw Boat Polar Curves with High Visibility Lines & Vertex Markers
    const twsList = state.selectedPolarTws === 'all' ? [8, 12, 16, 20, 25] : [state.selectedPolarTws];
    const colors = ['#06b6d4', '#f59e0b', '#ec4899'];
    const pointAngles = [35, 45, 60, 90, 110, 135, 150, 180];

    state.boats.forEach((boat, bIdx) => {
      if (!boat) return;
      const baseColor = colors[bIdx];

      twsList.forEach(tws => {
        ctx.beginPath();
        const points = [];

        pointAngles.forEach((ang) => {
          const spd = NAVAL_MATH.predictBoatSpeed(boat, tws, ang);
          const r = (spd / maxSpeedScale) * maxRadius;
          const rad = (ang - 90) * (Math.PI / 180);
          const px = centerX + r * Math.cos(rad);
          const py = centerY + r * Math.sin(rad);
          points.push({ x: px, y: py, spd: spd, ang: ang });
        });

        if (points.length > 0) {
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            const xc = (points[i - 1].x + points[i].x) / 2;
            const yc = (points[i - 1].y + points[i].y) / 2;
            ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
          }
          ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);

          ctx.strokeStyle = baseColor;
          ctx.lineWidth = (state.selectedPolarTws === 'all' && tws !== 16) ? 2.0 : 3.5;
          ctx.stroke();

          if (state.selectedPolarTws !== 'all') {
            ctx.lineTo(centerX, centerY);
            ctx.closePath();
            ctx.fillStyle = bIdx === 0 ? 'rgba(6, 182, 212, 0.12)' : (bIdx === 1 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(236, 72, 153, 0.12)');
            ctx.fill();

            points.forEach(pt => {
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, 4, 0, 2 * Math.PI);
              ctx.fillStyle = baseColor;
              ctx.fill();
              ctx.strokeStyle = '#0f172a';
              ctx.lineWidth = 1.5;
              ctx.stroke();
            });
          }
        }
      });
    });
  }

  /**
   * Render Multi-Dimensional Radar Spider Chart (Zoomable Edition)
   */
  function renderRadarChart() {
    const canvas = elements.radarCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const zoomFactor = state.radarZoom || 1.0;
    const radius = Math.min(width, height) * 0.35 * zoomFactor;

    ctx.clearRect(0, 0, width, height);

    const axes = [
      { name: "Light Air Speed", getScore: (m) => Math.min(10, Math.max(2, (m.raw.bruceNumber - 0.9) * 12)) },
      { name: "High Wind Reaching", getScore: (m) => Math.min(10, Math.max(3, (m.raw.estimatedBoatSpeed - 7) * 0.9)) },
      { name: "Upwind Pointing", getScore: (m, b) => b.keelType.toLowerCase().includes('dagger') ? 9.5 : 6.8 },
      { name: "Payload Capacity", getScore: (m, b) => Math.min(10, Math.max(3, (b.specs.payload_capacity_kg || 3500) / 600)) },
      { name: "Bridgedeck Clearance", getScore: (m, b) => Math.min(10, Math.max(3, (b.specs.bridgedeck_clearance_m || 0.8) * 10)) },
      { name: "Space & Volume", getScore: (m, b) => Math.min(10, Math.max(3, (b.specs.displacement_light_t / b.specs.loa_m) * 7.5)) }
    ];

    const totalAxes = axes.length;

    for (let level = 2; level <= 10; level += 2) {
      const r = (level / 10) * radius;
      ctx.beginPath();
      for (let i = 0; i < totalAxes; i++) {
        const angle = (i * 2 * Math.PI / totalAxes) - (Math.PI / 2);
        const x = centerX + r * Math.cos(angle);
        const y = centerY + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = level % 4 === 0 ? 'rgba(255, 255, 255, 0.03)' : 'transparent';
      ctx.fill();
      ctx.strokeStyle = level === 10 ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = level === 10 ? 1.5 : 1;
      ctx.stroke();

      drawPillBadge(ctx, centerX, centerY - r, `${level}/10`, '#0f172a', '#94a3b8', '#334155');
    }

    for (let i = 0; i < totalAxes; i++) {
      const angle = (i * 2 * Math.PI / totalAxes) - (Math.PI / 2);
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      const labelRadius = radius + 26;
      const lx = centerX + labelRadius * Math.cos(angle);
      const ly = centerY + labelRadius * Math.sin(angle);
      drawPillBadge(ctx, lx, ly, axes[i].name, '#1e293b', '#f8fafc', '#38bdf8');
    }

    const colors = ['#06b6d4', '#f59e0b', '#ec4899'];
    const fills = ['rgba(6, 182, 212, 0.22)', 'rgba(245, 158, 11, 0.22)', 'rgba(236, 72, 153, 0.22)'];

    state.boats.forEach((boat, bIdx) => {
      if (!boat) return;
      const m = NAVAL_MATH.calculateBoatMetrics(boat);
      const points = [];

      ctx.beginPath();
      for (let i = 0; i < totalAxes; i++) {
        const score = axes[i].getScore(m, boat);
        const r = (score / 10) * radius;
        const angle = (i * 2 * Math.PI / totalAxes) - (Math.PI / 2);
        const x = centerX + r * Math.cos(angle);
        const y = centerY + r * Math.sin(angle);
        points.push({ x, y, score });
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = fills[bIdx];
      ctx.fill();
      ctx.strokeStyle = colors[bIdx];
      ctx.lineWidth = 2.8;
      ctx.stroke();

      points.forEach(pt => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4.5, 0, 2 * Math.PI);
        ctx.fillStyle = colors[bIdx];
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    });
  }

  /**
   * Helper to draw clean, readable pill badges with background containers
   */
  function drawPillBadge(ctx, x, y, text, bgColor, textColor, borderColor, isBold) {
    ctx.font = isBold ? 'bold 11px Inter, sans-serif' : '600 10.5px Inter, sans-serif';
    const textWidth = ctx.measureText(text).width;
    const paddingX = 7;
    const boxW = textWidth + paddingX * 2;
    const boxH = 18;
    const boxX = x - boxW / 2;
    const boxY = y - boxH / 2;

    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 4);
    ctx.fill();

    if (borderColor) {
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 0.5);
  }

  /**
   * Render Sailing Vector Compass Visualizer
   */
  function renderCompassVector() {
    const canvas = elements.compassCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.40;

    ctx.clearRect(0, 0, width, height);

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HEADING 000°', centerX, centerY - radius - 12);
    ctx.fillText('180°', centerX, centerY + radius + 12);
    ctx.fillText('090° STBD', centerX + radius + 28, centerY);
    ctx.fillText('270° PORT', centerX - radius - 28, centerY);

    ctx.save();
    ctx.translate(centerX, centerY);
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.roundRect(-24, -22, 6, 44, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(18, -22, 6, 44, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(-18, -8, 36, 24);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -2, 3, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.restore();

    const twaRad = (state.sim.twa - 90) * (Math.PI / 180.0);
    const twX = centerX + radius * Math.cos(twaRad);
    const twY = centerY + radius * Math.sin(twaRad);

    drawArrow(ctx, twX, twY, centerX, centerY, '#3b82f6', 2.5, `TWS ${state.sim.tws} kn (${state.sim.twa}°)`);

    if (state.boats[0]) {
      const vpp1 = NAVAL_MATH.simulateSailPerformance(state.boats[0], state.sim);
      const awaRad = (vpp1.awa - 90) * (Math.PI / 180.0);
      const awX = centerX + (radius * 0.85) * Math.cos(awaRad);
      const awY = centerY + (radius * 0.85) * Math.sin(awaRad);
      drawArrow(ctx, awX, awY, centerX, centerY, '#06b6d4', 2.0, `AWS ${vpp1.aws} kn (${vpp1.awa}°)`);
    }
  }

  function drawArrow(ctx, fromX, fromY, toX, toY, color, width, label) {
    const headLen = 10;
    const angle = Math.atan2(toY - fromY, toX - fromX);

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    if (label) {
      ctx.fillStyle = color;
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, fromX, fromY - 6);
    }
  }

  /**
   * Update VPP Real-time Velocity Prediction Simulator
   */
  function updateVppSimulator() {
    if (!elements.simResultsContainer) return;
    elements.simResultsContainer.innerHTML = '';
    
    renderCompassVector();

    const isMetric = state.unit === 'metric';
    const allVpp = state.boats.map(b => b ? NAVAL_MATH.simulateSailPerformance(b, state.sim) : null);
    const speeds = allVpp.map(v => v ? v.boatSpeed : 0);
    const maxSpeed = Math.max(...speeds);

    state.boats.forEach((boat, idx) => {
      if (!boat) return;
      const bIdx = idx + 1;
      const v = allVpp[idx];
      const isFastest = v.boatSpeed === maxSpeed && maxSpeed > 0;
      const areaUnit = isMetric ? "m²" : "sq ft";
      const totalAreaVal = isMetric ? v.activeTotalArea : Math.round(v.activeTotalArea * 10.7639);
      const safeClass = v.safetyStatus.replace(/\s+/g, '-');
      const coreBadge = boat.coreCategory || "Balsa / Foam";
      const marketPrice = boat.avgMarketPrice || boat.priceEstimate || "Contact Dealer";

      const card = document.createElement('div');
      card.className = `vpp-boat-card boat${bIdx}`;
      card.innerHTML = `
        <div class="vpp-card-header">
          <div>
            <div class="vpp-boat-brand">${boat.manufacturer} • ${coreBadge}</div>
            <div class="vpp-boat-name">${boat.name}</div>
          </div>
          ${isFastest ? '<span style="background: rgba(16, 185, 129, 0.2); color: #34d399; font-size: 0.72rem; font-weight: 800; padding: 2px 8px; border-radius: 999px; border: 1px solid rgba(16, 185, 129, 0.4);">★ FASTEST</span>' : ''}
        </div>

        <div class="vpp-speed-display">
          <div class="vpp-main-speed" style="color: var(--boat${bIdx}-color)">${v.boatSpeed.toFixed(1)}</div>
          <div class="vpp-speed-unit">knots</div>
        </div>
        <div class="vpp-speed-sub">${v.sailPerformancePercent}% of True Windspeed</div>

        <div class="vmg-metrics-row">
          <div class="vmg-item">
            <span class="vmg-label">Apparent Wind</span>
            <span class="vmg-val">${v.aws} kn @ ${v.awa}°</span>
          </div>
          <div class="vmg-item">
            <span class="vmg-label">${state.sim.twa < 90 ? 'Upwind VMG' : 'Downwind VMG'}</span>
            <span class="vmg-val">${state.sim.twa < 90 ? v.upwindVmg : v.downwindVmg} kn</span>
          </div>
        </div>

        <div class="vpp-detail-specs">
          <div class="vpp-spec-row">
            <span class="name">Leeway Drift</span>
            <span class="val" style="color: #38bdf8;">${v.leewayAngle}° (Track: ${v.trackAngleRelWind}°)</span>
          </div>
          <div class="vpp-spec-row">
            <span class="name">Active Sail Area</span>
            <span class="val">${totalAreaVal} ${areaUnit} (${v.sailPowerRatioPercent}%)</span>
          </div>
          <div class="vpp-spec-row">
            <span class="name">Max Polar Speed</span>
            <span class="val" style="color: #34d399;">${v.maxPolarSpeed} kn (@ ${v.maxPolarTwa}° in ${v.maxPolarTws}kn)</span>
          </div>
          <div class="vpp-spec-row">
            <span class="name">YachtWorld Avg Market</span>
            <span class="val" style="color: #fbbf24;">${marketPrice}</span>
          </div>
        </div>

        <div class="vpp-safety-alert ${safeClass}">
          <strong>${v.safetyStatus}:</strong> ${v.safetyNotice}
        </div>
      `;
      elements.simResultsContainer.appendChild(card);
    });
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

