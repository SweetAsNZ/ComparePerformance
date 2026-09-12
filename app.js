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
    simTws: 16,
    simTwa: 90
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
    twsPillsContainer: document.getElementById('twsPillsContainer'),
    simTwsInput: document.getElementById('simTwsInput'),
    simTwaInput: document.getElementById('simTwaInput'),
    simTwsVal: document.getElementById('simTwsVal'),
    simTwaVal: document.getElementById('simTwaVal'),
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
   * Parse URL Query parameters (e.g. ?key1=Fountaine+Pajot+47+Tanna&key2=Fountaine+Pajot+51+Aura&key3=Leopard+52)
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

        // Trigger canvas resize/render when switching tabs
        if (targetId === 'tabPolars') {
          renderPolarChart();
          renderRadarChart();
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

    // VPP Simulator Sliders
    elements.simTwsInput.addEventListener('input', (e) => {
      state.simTws = parseInt(e.target.value, 10);
      elements.simTwsVal.textContent = state.simTws + ' kn';
      updateVppSimulator();
    });

    elements.simTwaInput.addEventListener('input', (e) => {
      state.simTwa = parseInt(e.target.value, 10);
      elements.simTwaVal.textContent = state.simTwa + '°';
      updateVppSimulator();
    });

    window.addEventListener('resize', () => {
      renderPolarChart();
      renderRadarChart();
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

      const card = document.createElement('div');
      card.className = `boat-hero-card boat${bIdx}`;
      card.innerHTML = `
        <div class="boat-hero-img-wrap">
          <img src="${boat.image}" alt="${boat.manufacturer} ${boat.name}" class="boat-hero-img" onerror="this.src='https://images.unsplash.com/photo-1540946485063-a40da27545f8?auto=format&fit=crop&w=1000&q=80'" />
          <span class="boat-category-badge">${boat.category}</span>
        </div>
        <div class="boat-hero-body">
          <div class="boat-builder-name">${boat.manufacturer}</div>
          <h2 class="boat-model-name">${boat.name}</h2>
          
          <div class="hero-stats-banner">
            <div class="hero-stat-item">
              <div class="hero-stat-label">Sail Performance</div>
              <div class="hero-stat-val" style="color: var(--boat${bIdx}-color)">${metrics.indicators.sailPerf.value}<span>%</span></div>
            </div>
            <div class="hero-stat-item">
              <div class="hero-stat-label">Boat Speed (15kn)</div>
              <div class="hero-stat-val">${metrics.indicators.boatSpeed.value}<span> kn</span></div>
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
   * Render Performance Indicator Rows (matching CatamaranShow exact math and visual layout)
   */
  function renderPerformanceIndicators() {
    elements.indicatorsContainer.innerHTML = '';
    
    const indicatorKeys = [
      'sailPerf',
      'boatSpeed',
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
   * Render Comprehensive Technical Specifications Table
   */
  function renderSpecificationsTable() {
    const isMetric = state.unit === 'metric';
    const allMetrics = state.boats.map(b => b ? NAVAL_MATH.calculateBoatMetrics(b) : null);

    // Update Headers
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
        name: "Design & Construction",
        rows: [
          { label: "Naval Architect / Designer", getVal: (m, b) => b.designer },
          { label: "Interior Designer", getVal: (m, b) => b.interiorDesigner || b.designer },
          { label: "Keel / Appendage Type", getVal: (m, b) => b.keelType },
          { label: "Helm Station Configuration", getVal: (m, b) => b.helmType },
          { label: "Steering Mechanism", getVal: (m, b) => b.steering || "Direct Linkage" },
          { label: "Standard Engines", getVal: (m, b) => b.engines },
          { label: "Hull Material & Core", getVal: (m, b) => b.hullMaterial },
          { label: "CE Ocean Category", getVal: (m, b) => b.ceCategory },
          { label: "Production Years", getVal: (m, b) => b.year },
          { label: "Estimated Base Price", getVal: (m, b) => b.priceEstimate },
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
   * Render Interactive Polar Diagram on HTML5 Canvas
   */
  function renderPolarChart() {
    const canvas = elements.polarCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Set proper resolution
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const centerX = width / 2;
    const centerY = height * 0.90;
    const maxRadius = Math.min(width * 0.44, height * 0.82);
    const maxSpeedScale = 25; // 25 knots scale

    ctx.clearRect(0, 0, width, height);

    // 1. Draw Concentric Speed Rings (5, 10, 15, 20, 25 kn)
    const speedRings = [5, 10, 15, 20, 25];
    speedRings.forEach(spd => {
      const r = (spd / maxSpeedScale) * maxRadius;
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, Math.PI, 2 * Math.PI, false);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Speed Ring Label
      ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${spd} kn`, centerX - r - 4, centerY - 2);
      ctx.textAlign = 'left';
      ctx.fillText(`${spd} kn`, centerX + r + 4, centerY - 2);
    });

    // 2. Draw Angle Radial Lines (30°, 45°, 60°, 90°, 110°, 135°, 150°, 180°)
    const angles = [30, 45, 60, 90, 110, 135, 150, 180];
    angles.forEach(deg => {
      // Symmetrical display (both starboard and port or half-view)
      // Standard yacht polar is shown right side (starboard) 0° to 180°
      const rad = (deg - 90) * (Math.PI / 180);
      const x = centerX + maxRadius * Math.cos(rad);
      const y = centerY + maxRadius * Math.sin(rad);

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = deg === 90 ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Angle Label
      const labelX = centerX + (maxRadius + 14) * Math.cos(rad);
      const labelY = centerY + (maxRadius + 14) * Math.sin(rad);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${deg}°`, labelX, labelY);
    });

    // Draw Wind Origin Arrow at 0° (top)
    ctx.fillStyle = '#38bdf8';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TRUE WIND (0°)', centerX, centerY - maxRadius - 18);

    // 3. Draw Boat Polar Curves
    const twsList = state.selectedPolarTws === 'all' ? [8, 12, 16, 20, 25] : [state.selectedPolarTws];
    const colors = ['#06b6d4', '#f59e0b', '#ec4899'];

    state.boats.forEach((boat, bIdx) => {
      if (!boat) return;
      const baseColor = colors[bIdx];

      twsList.forEach(tws => {
        ctx.beginPath();
        const polarAngles = [35, 45, 60, 90, 110, 135, 150, 180];
        const points = [];

        polarAngles.forEach((ang, idx) => {
          const spd = NAVAL_MATH.predictBoatSpeed(boat, tws, ang);
          const r = (spd / maxSpeedScale) * maxRadius;
          const rad = (ang - 90) * (Math.PI / 180);
          const px = centerX + r * Math.cos(rad);
          const py = centerY + r * Math.sin(rad);
          points.push({ x: px, y: py });
        });

        if (points.length > 0) {
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            // Smooth curve
            const xc = (points[i - 1].x + points[i].x) / 2;
            const yc = (points[i - 1].y + points[i].y) / 2;
            ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
          }
          ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);

          ctx.strokeStyle = baseColor;
          ctx.lineWidth = (state.selectedPolarTws === 'all' && tws !== 16) ? 1.5 : 2.5;
          ctx.stroke();

          // Fill area subtly
          if (state.selectedPolarTws !== 'all') {
            ctx.lineTo(centerX, centerY);
            ctx.closePath();
            ctx.fillStyle = baseColor === '#06b6d4' ? 'rgba(6, 182, 212, 0.08)' : (baseColor === '#f59e0b' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(236, 72, 153, 0.08)');
            ctx.fill();
          }
        }
      });
    });
  }

  /**
   * Render Multi-Dimensional Radar Spider Chart
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
    const radius = Math.min(width, height) * 0.36;

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

    // Draw Polygonal Grid Lines (2, 4, 6, 8, 10)
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
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw Axis Spokes & Labels
    for (let i = 0; i < totalAxes; i++) {
      const angle = (i * 2 * Math.PI / totalAxes) - (Math.PI / 2);
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.stroke();

      // Axis Label
      const labelRadius = radius + 20;
      const lx = centerX + labelRadius * Math.cos(angle);
      const ly = centerY + labelRadius * Math.sin(angle);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(axes[i].name, lx, ly);
    }

    // Plot Boat Polygons
    const colors = ['#06b6d4', '#f59e0b', '#ec4899'];
    const fills = ['rgba(6, 182, 212, 0.2)', 'rgba(245, 158, 11, 0.2)', 'rgba(236, 72, 153, 0.2)'];

    state.boats.forEach((boat, bIdx) => {
      if (!boat) return;
      const m = NAVAL_MATH.calculateBoatMetrics(boat);

      ctx.beginPath();
      for (let i = 0; i < totalAxes; i++) {
        const score = axes[i].getScore(m, boat);
        const r = (score / 10) * radius;
        const angle = (i * 2 * Math.PI / totalAxes) - (Math.PI / 2);
        const x = centerX + r * Math.cos(angle);
        const y = centerY + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = fills[bIdx];
      ctx.fill();
      ctx.strokeStyle = colors[bIdx];
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }

  /**
   * Update VPP Real-time Velocity Prediction Simulator
   */
  function updateVppSimulator() {
    elements.simResultsContainer.innerHTML = '';
    const speeds = state.boats.map(b => b ? NAVAL_MATH.predictBoatSpeed(b, state.simTws, state.simTwa) : 0);
    const maxSpeed = Math.max(...speeds);

    state.boats.forEach((boat, idx) => {
      if (!boat) return;
      const bIdx = idx + 1;
      const spd = speeds[idx];
      const perfRatio = Math.round((spd / state.simTws) * 100);
      const isFastest = spd === maxSpeed && maxSpeed > 0;

      const card = document.createElement('div');
      card.className = `vpp-boat-result boat${bIdx}`;
      card.innerHTML = `
        <div class="vpp-boat-title" style="color: var(--boat${bIdx}-color)">
          ${boat.manufacturer} ${boat.name}
          ${isFastest ? '<span style="color: #10b981; font-size: 0.75rem; margin-left: 4px;">★ FASTEST</span>' : ''}
        </div>
        <div class="vpp-speed-meter" style="color: var(--boat${bIdx}-color)">
          ${spd.toFixed(1)} <span>kn</span>
        </div>
        <div class="vpp-perf-ratio">
          ${perfRatio}% of Windspeed
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
