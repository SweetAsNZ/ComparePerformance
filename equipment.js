/**
 * Equipment, Spares, Maintenance History & "Comparative Price" Module
 *
 * Lets the user catalogue every piece of equipment and spare part fitted to each of the 3
 * compared boats (parsed from an uploaded PDF/CSV, pasted webpage/forum/social-post text, or
 * typed in manually), plus a maintenance history log, and derives:
 *  - Replacement due dates and an age/condition status (OK / Due Soon / Overdue) per item
 *  - A depreciation-adjusted "My Buy Price" (asking price minus accrued depreciation)
 *  - A "Comparative Price" - My Buy Price plus the cost to buy & install whatever equipment/
 *    spares a boat is missing relative to the best-equipped boat(s) in the current comparison,
 *    so every boat can be judged on a like-for-like, equally-equipped basis
 *  - An optional manual "Ideal / Model Boat" override (a nominated best-equipped boat and/or
 *    starred items) that takes precedence over the automatic best-in-class comparison per category
 *
 * Research Import: rather than any automated login/scraping of social media or forums (which
 * would violate most platforms' terms of service and is a security risk for credentials/MFA),
 * the user copies text themselves from a source they're already logged into and pastes it here;
 * an optional "Source" note can be attached to each imported row for provenance.
 *
 * All data is stored client-side only (localStorage) - nothing is uploaded anywhere.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'cc_equipment_data_v1';
  const ASKING_PRICE_KEY = 'cc_equipment_asking_prices_v1';
  const MODEL_BOAT_KEY = 'cc_equipment_model_boat_v1';
  const MAINTENANCE_KEY = 'cc_equipment_maintenance_v1';
  const CABINS_KEY = 'cc_equipment_cabins_v1';
  const NICKNAME_KEY = 'cc_equipment_nicknames_v1';
  const COLLAPSED_KEY = 'cc_equipment_collapsed_v1';
  const pricing = window.EQUIPMENT_PRICING;
  let priceDatabaseReady = Promise.resolve();
  const PDFJS_MODULE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.4.299/pdf.min.mjs';
  const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.4.299/pdf.worker.min.mjs';

  const CATEGORY_OPTIONS = [
    'Engines & Drivetrain', 'Generator', 'Sails', 'Standing Rigging', 'Running Rigging & Lines',
    'Electronics & Nav', 'Electrical & Batteries', 'Solar & Power Mgmt', 'Deck Gear & Winches',
    'Anchor & Windlass', 'Safety & Liferaft', 'Galley & Appliances', 'Air Con & Heating',
    'Watermaker', 'Plumbing & Pumps', 'Tender & Outboard', 'Davits', 'Upholstery & Interior', 'Other'
  ];

  // Typical useful-life defaults (years) used when a life expectancy isn't supplied or parsed.
  const CATEGORY_LIFE_DEFAULTS = {
    'Engines & Drivetrain': 20, 'Generator': 15, 'Sails': 10, 'Standing Rigging': 12,
    'Running Rigging & Lines': 6, 'Electronics & Nav': 8, 'Electrical & Batteries': 6,
    'Solar & Power Mgmt': 10, 'Deck Gear & Winches': 20, 'Anchor & Windlass': 15,
    'Safety & Liferaft': 12, 'Galley & Appliances': 10, 'Air Con & Heating': 10,
    'Watermaker': 12, 'Plumbing & Pumps': 10, 'Tender & Outboard': 10, 'Davits': 15,
    'Upholstery & Interior': 12, 'Other': 10
  };

  // Running-hours life defaults for machinery that's really "due" by hours of use, not calendar
  // age (e.g. a 10-year-old engine with 500 hours is nowhere near due). Only engines/generators
  // get a default here; everything else relies on the age-based life expectancy above.
  const CATEGORY_LIFE_HOURS_DEFAULTS = {
    'Engines & Drivetrain': 5000, 'Generator': 5000
  };

  // Ordered keyword rules used to guess a category from an item name when none is supplied.
  const CATEGORY_GUESS_RULES = [
    [/engine|diesel|yanmar|volvo ?penta|saildrive|sail ?drive|gearbox|propeller|shaft/i, 'Engines & Drivetrain'],
    [/generator|genset/i, 'Generator'],
    [/main ?sail|genoa|self.?tack|jib|spinnaker|gennaker|code ?0|code ?d|screecher|parasailor|storm ?sail/i, 'Sails'],
    [/shroud|forestay|backstay|standing rigging|furler/i, 'Standing Rigging'],
    [/sheet|halyard|line|rope|running rigging/i, 'Running Rigging & Lines'],
    [/chartplotter|radar|\bais\b|autopilot|\bgps\b|instrument|navtex|\bvhf\b|transducer|wind sensor|multifunction display|\bmfd\b/i, 'Electronics & Nav'],
    [/batter(y|ies)|lithium|inverter|charger|alternator|\bbms\b/i, 'Electrical & Batteries'],
    [/solar|mppt/i, 'Solar & Power Mgmt'],
    [/winch|traveller|clutch|furling drum/i, 'Deck Gear & Winches'],
    [/anchor|windlass|chain/i, 'Anchor & Windlass'],
    [/liferaft|life raft|epirb|flare|jackline|harness|man overboard|\bmob\b/i, 'Safety & Liferaft'],
    [/fridge|freezer|stove|oven|galley|microwave/i, 'Galley & Appliances'],
    [/air ?con|a\/c|heater|heating|webasto|eberspacher/i, 'Air Con & Heating'],
    [/watermaker|water maker|desalin/i, 'Watermaker'],
    [/\bpump\b|plumbing|\bhead\b|toilet|holding tank/i, 'Plumbing & Pumps'],
    [/dinghy|tender|outboard/i, 'Tender & Outboard'],
    [/davit/i, 'Davits'],
    [/upholstery|cushion|interior|curtain|carpet/i, 'Upholstery & Interior']
  ];

  // Auto-classification: decides whether an imported/parsed row is equipment, a spare part, or a
  // maintenance history entry, purely from keywords in its name/description text. This lets the
  // user import a batch of mixed PDFs/CSVs without picking a kind up front; each row's guess is
  // shown (and editable) in the staging table before anything is added to a boat.
  const MAINTENANCE_GUESS_RE = /\b(service(d|s)?|repair(ed|s)?|replace(d|s|ment)?|inspect(ed|ion|s)?|overhaul(ed|s)?|rebuil[dt]|maintenance|antifoul(ed|ing)?|survey(ed)?|oil change|haul[- ]?out|tuned|calibrat(ed|ion)|repack(ed)?|serviced|descaled?)\b/i;
  const SPARE_GUESS_RE = /\bspares?\b|\bback[- ]?up\b|\bspare (kit|part|set)s?\b/i;

  function classifyKind(text) {
    if (!text) return 'equipment';
    if (MAINTENANCE_GUESS_RE.test(text)) return 'maintenance';
    if (SPARE_GUESS_RE.test(text)) return 'spare';
    return 'equipment';
  }

  const equipmentState = {
    data: loadJson(STORAGE_KEY, {}),              // { [boatId]: EquipmentItem[] } (kind: 'equipment' | 'spare')
    askingPrices: loadJson(ASKING_PRICE_KEY, {}),  // { [boatId]: number }
    modelBoatId: loadJson(MODEL_BOAT_KEY, null),   // boatId nominated as the "best equipped" model (manual override)
    maintenanceLog: loadJson(MAINTENANCE_KEY, {}), // { [boatId]: MaintenanceEntry[] }
    cabins: loadJson(CABINS_KEY, {}),              // { [boatId]: number } - actual cabin count of this specific real boat (used for Charter Boat detection)
    nicknames: loadJson(NICKNAME_KEY, {}),         // { [boatId]: string } - this specific real boat's own name (e.g. "Seaduction"), auto-detected from an imported folder name or entered manually
    pendingImport: [],                             // staged rows (mixed kinds) awaiting review/commit
    importDrafts: {},
    importBoatId: null,
    activeSlot: 1,                                 // which boat slot (1/2/3) new/imported rows go to
    activeKind: 'equipment',                       // 'equipment' | 'spare' | 'maintenance' - used only for the "+ Add row" manual button
    cardSubTab: {},                                // { [boatId]: 'equipment' | 'spare' | 'maintenance' } (UI only, not persisted)
    collapsedTables: loadJson(COLLAPSED_KEY, {}),
    stagingCollapsed: false                        // whether the (potentially huge) staging table is minimized, keeping just the header/buttons visible
  };

  const elements = {};

  // ---------------------------------------------------------------------
  // Persistence helpers
  // ---------------------------------------------------------------------
  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(equipmentState.data)); }
  function saveAskingPrices() { localStorage.setItem(ASKING_PRICE_KEY, JSON.stringify(equipmentState.askingPrices)); }
  function saveModelBoat() { localStorage.setItem(MODEL_BOAT_KEY, JSON.stringify(equipmentState.modelBoatId)); }
  function saveMaintenanceLog() { localStorage.setItem(MAINTENANCE_KEY, JSON.stringify(equipmentState.maintenanceLog)); }
  function saveCabins() { localStorage.setItem(CABINS_KEY, JSON.stringify(equipmentState.cabins)); }
  function saveNicknames() { localStorage.setItem(NICKNAME_KEY, JSON.stringify(equipmentState.nicknames)); }

  function uid() { return 'eq_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  // ---------------------------------------------------------------------
  // Small utilities
  // ---------------------------------------------------------------------
  function parseMoney(str) {
    if (str === undefined || str === null) return 0;
    const cleaned = String(str).replace(/[^0-9.\-]/g, '');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function parseDateFlexible(str) {
    if (!str) return '';
    const s = String(str).trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
    m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (m) {
      let day = parseInt(m[1], 10), month = parseInt(m[2], 10), year = parseInt(m[3], 10);
      if (year < 100) year += (year < 70 ? 2000 : 1900);
      if (month > 12) { const t = day; day = month; month = t; } // swap if clearly mm/dd input
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return `${year}-${pad2(month)}-${pad2(day)}`;
    }
    const d = new Date(s);
    // Use local date parts (not toISOString, which converts to UTC and can shift the day
    // backwards for timezones ahead of UTC) so month/year-only dates like "May 2021" land correctly.
    if (!isNaN(d.getTime())) return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    return '';
  }

  function formatMoney(n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    const sign = n < 0 ? '-' : '';
    return sign + '$' + Math.round(Math.abs(n)).toLocaleString();
  }

  function importCurrency() {
    return document.getElementById('equipmentImportCurrency')?.value || 'USD';
  }

  function importedPrice(raw, currency) {
    const amount = parseMoney(raw);
    const originalCurrency = pricing.currencyOf(raw, currency || importCurrency());
    return {
      usd: pricing.toUSD(amount, originalCurrency),
      info: { status: 'document', amount, currency: originalCurrency, quantity: 1,
        fxDate: pricing.fx.date, fxRate: 1 / pricing.fx.perUSD[originalCurrency],
        fxSource: pricing.fx.source }
    };
  }

  function enrichPrice(row) {
    if (row.rrp > 0 || row.priceInfo || row.kind === 'maintenance') return row;
    const estimate = pricing.lookup(row.name);
    if (estimate) { row.rrp = estimate.usd; row.priceInfo = estimate; }
    return row;
  }

  function renderPriceInfo(item) {
    const info = item.priceInfo;
    let label = item.rrp > 0 ? 'Entered USD' : 'Needs price';
    if (info?.status === 'estimate') label = `Estimate: ${info.model}`;
    if (info?.status === 'document') label = 'Document price';
    if (info?.status === 'manual') label = 'Entered USD';
    const conversion = info && info.currency && info.status !== 'manual'
      ? `<div>${Number(info.quantity) || 1} x ${escAttr(info.currency)} ${Number(info.amount)}; ${info.currency === 'USD' ? 'no FX' : `USD rate ${Number(info.fxRate).toFixed(6)} (${escAttr(info.fxDate)})`}</div>` : '';
    const source = info?.url && /^https?:\/\//i.test(info.url)
      ? `<a href="${escAttr(info.url)}" target="_blank" rel="noopener noreferrer">Price source (${escAttr(info.checkedDate)})</a>` : '';
    const fxSource = info?.currency && info.currency !== 'USD' && /^https?:\/\//i.test(info.fxSource || '')
      ? ` <a href="${escAttr(info.fxSource)}" target="_blank" rel="noopener noreferrer">FX source</a>` : '';
    const note = info?.note ? `<div>${escAttr(info.note)}</div>` : '';
    const research = !(item.rrp > 0) ? pricing.research(item.name) : null;
    const researchHtml = research ? `<details><summary>Research results (${research.components.length} priced component${research.components.length === 1 ? '' : 's'})</summary>
      <p>${escAttr(research.explanation)}</p>
      ${item.kind === 'maintenance' ? '<p>Replacement references only, not evidence of historical maintenance spend. Correct the row kind if this describes installed equipment instead of a maintenance event.</p>' : ''}
      ${research.components.map(ref => `<div><strong>${escAttr(ref.model)}:</strong> ${escAttr(ref.currency)} ${ref.amount} / unit = ${formatMoney(ref.usd)} USD.
        <a href="${escAttr(ref.url)}" target="_blank" rel="noopener noreferrer">Price source (${escAttr(ref.checkedDate)})</a>
        ${ref.currency !== 'USD' ? `<a href="${escAttr(ref.fxSource)}" target="_blank" rel="noopener noreferrer">FX (${escAttr(ref.fxDate)})</a>` : ''}
        ${escAttr(ref.note)}</div>`).join('')}
      ${research.notes.map(ref => `<p>${escAttr(ref.model)}: ${escAttr(ref.note)}${ref.url ? ` <a href="${escAttr(ref.url)}" target="_blank" rel="noopener noreferrer">Reference</a>` : ''}</p>`).join('')}
      </details>` : '';
    return `<div class="eq-price-note">${escAttr(label)}${conversion}${source}${fxSource}${note}${researchHtml}</div>`;
  }

  function renderQuoteEditor(item, attributes) {
    if (item.kind === 'maintenance') return '';
    return `<details class="eq-price-note"><summary>Enter researched price</summary>
      <label>Quoted amount <input type="number" min="0" step="0.01" class="eq-input" data-field="quoteAmount" ${attributes} value="${escAttr(item.quoteAmount ?? '')}"></label>
      <label>Currency <select class="eq-input" data-field="quoteCurrency" ${attributes}>${Object.keys(pricing.fx.perUSD).map(c => `<option ${c === (item.quoteCurrency || 'USD') ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
      <label>Price source URL <input type="url" class="eq-input" data-field="quoteUrl" ${attributes} value="${escAttr(item.quoteUrl || '')}"></label>
      <button type="button" class="btn-icon" data-action="apply-quote" ${attributes}>Convert / apply USD</button>
      <span>Enter the total for this row's quantity. FX: ${pricing.fx.date}.</span>
    </details>`;
  }

  function applyQuote(item) {
    try {
      if (item.quoteAmount === '' || item.quoteAmount == null) throw new Error('Enter a quoted amount first.');
      item.priceInfo = pricing.quote(Number(item.quoteAmount), item.quoteCurrency || 'USD', item.quoteUrl || '');
      item.rrp = item.priceInfo.usd;
      return true;
    } catch (err) {
      showToastLocal(err.message);
      return false;
    }
  }

  function escAttr(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function guessCategory(name) {
    if (!name) return 'Other';
    for (const [re, cat] of CATEGORY_GUESS_RULES) { if (re.test(name)) return cat; }
    return 'Other';
  }

  function defaultLifeForCategory(cat) { return CATEGORY_LIFE_DEFAULTS[cat] || 10; }

  // 0 (not 10) is the right "no default" here: most categories simply aren't tracked by hours.
  function defaultLifeHoursForCategory(cat) { return CATEGORY_LIFE_HOURS_DEFAULTS[cat] || 0; }

  function showToastLocal(msg) {
    const el = document.getElementById('toastNotice');
    if (!el) { return; }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(showToastLocal._t);
    showToastLocal._t = setTimeout(() => el.classList.remove('show'), 3000);
  }

  function downloadBlob(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function csvEscape(v) {
    const s = String(v === null || v === undefined ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  // ---------------------------------------------------------------------
  // Boat lookups
  // ---------------------------------------------------------------------
  function getSlotBoat(slot) {
    const sel = document.getElementById('boatSelect' + slot);
    if (!sel || !sel.value) return null;
    return (typeof CATAMARAN_DATABASE !== 'undefined')
      ? CATAMARAN_DATABASE.find(b => b.id === sel.value) || null
      : null;
  }

  function getBoatById(boatId) {
    return (typeof CATAMARAN_DATABASE !== 'undefined')
      ? CATAMARAN_DATABASE.find(b => b.id === boatId) || null
      : null;
  }

  function getEquipmentForBoat(boatId) { return equipmentState.data[boatId] || []; }

  // Equipment + spares only (excludes nothing today, but keeps the door open for future kinds).
  function getComparableItems(boatId) { return getEquipmentForBoat(boatId); }

  function getMaintenanceForBoat(boatId) { return equipmentState.maintenanceLog[boatId] || []; }

  // The boatIds currently placed in the 3 comparison slots, used as the default auto-benchmark set.
  function getCompareBoatIds() {
    return [1, 2, 3].map(s => getSlotBoat(s)).filter(Boolean).map(b => b.id);
  }

  function itemTotal(item) { return (Number(item.rrp) || 0) + (Number(item.installCost) || 0); }

  function parsePriceFromText(text) {
    if (!text) return null;
    const m = String(text).match(/[\d,]+/);
    return m ? parseInt(m[0].replace(/,/g, ''), 10) : null;
  }

  function getAskingPrice(boatId, boat) {
    if (equipmentState.askingPrices[boatId] != null) return equipmentState.askingPrices[boatId];
    const guess = parsePriceFromText(boat && (boat.avgMarketPrice || boat.priceEstimate));
    return guess || 0;
  }

  // ---------------------------------------------------------------------
  // Depreciation math
  // ---------------------------------------------------------------------
  function computeItemMetrics(item, asOfDate) {
    const rrp = Number(item.rrp) || 0;
    const installCost = Number(item.installCost) || 0;
    const totalCost = rrp + installCost;
    const lifeYears = Number(item.lifeYears) || 0;
    const hours = item.hours !== '' && item.hours != null ? Number(item.hours) : null;
    const lifeHours = Number(item.lifeHours) || 0;

    let ageYears = null, remainingYears = null, depreciationFraction = 0, currentValue = totalCost,
      status = 'unknown', dueDate = null, hoursFraction = null, remainingHours = null;

    if (item.installDate) {
      const installed = new Date(item.installDate);
      if (!isNaN(installed.getTime())) {
        ageYears = (asOfDate - installed) / (365.25 * 86400000);
        if (lifeYears > 0) {
          dueDate = new Date(installed.getTime() + lifeYears * 365.25 * 86400000);
          depreciationFraction = Math.min(1, Math.max(0, ageYears / lifeYears));
          remainingYears = Math.max(0, lifeYears - ageYears);
          currentValue = totalCost * (1 - depreciationFraction);
          const dueSoonThreshold = Math.max(0.5, lifeYears * 0.15);
          if (depreciationFraction >= 1) status = 'overdue';
          else if (remainingYears <= dueSoonThreshold) status = 'due-soon';
          else status = 'ok';
        }
      }
    }

    // Running-hours wear (engines, generators, etc.) takes over from calendar age whenever
    // actual hours have been logged: a low-hours engine on an old boat genuinely isn't due just
    // because years have passed, and a heavily-used one can be due well before its "age" life
    // expectancy would suggest. Hours, when tracked, are the authoritative replacement signal.
    if (hours !== null && lifeHours > 0) {
      hoursFraction = Math.min(1, Math.max(0, hours / lifeHours));
      remainingHours = Math.max(0, lifeHours - hours);
      depreciationFraction = hoursFraction;
      currentValue = totalCost * (1 - hoursFraction);
      const dueSoonHoursThreshold = Math.max(250, lifeHours * 0.15);
      if (hoursFraction >= 1) status = 'overdue';
      else if (remainingHours <= dueSoonHoursThreshold) status = 'due-soon';
      else status = 'ok';
    }

    const accruedDepreciation = totalCost - currentValue;
    return {
      totalCost, ageYears, remainingYears, depreciationFraction, currentValue, accruedDepreciation,
      status, dueDate, hoursFraction, remainingHours
    };
  }

  // ---------------------------------------------------------------------
  // Parsers: CSV, pasted text/HTML, PDF
  // ---------------------------------------------------------------------
  function splitCsvLine(line) {
    const result = []; let cur = ''; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) { result.push(cur); cur = ''; }
      else cur += ch;
    }
    result.push(cur);
    return result.map(s => s.trim());
  }

  function normalizeKey(k) { return String(k).toLowerCase().replace(/[^a-z0-9]/g, ''); }

  // Lets a telling file name (e.g. "Spares List.pdf") nudge classification when a line's own
  // wording isn't distinctive enough to tell equipment apart from spares/maintenance history.
  function kindHintFromFilename(name) {
    if (!name) return '';
    if (/\bspares?\b/i.test(name)) return 'spare';
    if (/\b(maintenance|service\s*log|service\s*history|repairs?)\b/i.test(name)) return 'maintenance';
    return '';
  }

  function mapRowUniversal(obj, source, defaultSourceNote, kindHint) {
    const norm = {};
    Object.keys(obj).forEach(k => { norm[normalizeKey(k)] = obj[k]; });
    const pick = (...keys) => {
      for (const k of keys) {
        const v = norm[normalizeKey(k)];
        if (v !== undefined && String(v).trim() !== '') return v;
      }
      return '';
    };
    const name = pick('name', 'item', 'equipment', 'description', 'product', 'title', 'work', 'details') || 'Unnamed item';
    const category = pick('category', 'type', 'group') || guessCategory(name);
    const rawPrice = pick('rrp', 'price', 'msrp', 'retailprice', 'listprice', 'cost', 'unitprice', 'amount', 'total');
    const currency = pick('currency') || importCurrency();
    const price = importedPrice(rawPrice, currency);
    const rrp = price.usd;
    const installCost = importedPrice(pick('installcost', 'install', 'labour', 'labor', 'fittingcost', 'laborcost'), currency).usd;
    const installDate = parseDateFlexible(pick('installdate', 'dateinstalled', 'date', 'purchased', 'purchasedate', 'fitted', 'servicedate', 'maintenancedate', 'performed'));
    const lifeRaw = pick('lifeyears', 'lifeexpectancy', 'lifeexpectancyyears', 'expectedlife', 'lifespan', 'usefullife', 'shelflife');
    const lifeYears = lifeRaw !== '' ? (parseFloat(lifeRaw) || defaultLifeForCategory(category)) : defaultLifeForCategory(category);
    const hoursRaw = pick('hours', 'enginehours', 'runninghours', 'currenthours', 'hourscurrent', 'hourmeter');
    const hours = hoursRaw !== '' ? (parseFloat(hoursRaw) || 0) : '';
    const lifeHoursRaw = pick('lifehours', 'lifeexpectancyhours', 'hourslifeexpectancy', 'expectedlifehours', 'tbohours', 'overhaulhours');
    const lifeHours = lifeHoursRaw !== '' ? (parseFloat(lifeHoursRaw) || 0) : defaultLifeHoursForCategory(category);
    const notes = pick('notes', 'comment', 'comments', 'remarks');
    // Provenance is worked out automatically - a "Source"/"Link" column in the file if present,
    // otherwise the originating file name/path or a URL detected in pasted text (see callers below).
    const sourceNote = pick('source', 'sourcenote', 'seenat', 'link', 'url') || defaultSourceNote || '';
    const savedPriceInfo = pick('pricereference');
    const priceInfo = savedPriceInfo ? JSON.parse(savedPriceInfo) : (rawPrice !== '' ? price.info : undefined);
    const explicitKind = normalizeKey(pick('kind'));
    let kind = ['equipment', 'spare', 'maintenance'].includes(explicitKind) ? explicitKind : classifyKind(name + ' ' + category);
    if (!explicitKind && kindHint === 'spare') kind = 'spare';
    else if (kind === 'equipment' && kindHint && !explicitKind) kind = kindHint;
    return {
      id: uid(), kind, name, category, rrp, installCost, installDate,
      lifeYears, hours, lifeHours, notes, ideal: false, source: source || 'import', sourceNote,
      priceInfo
    };
  }

  function parseCSV(text, defaultSourceNote, kindHint) {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length);
    if (!lines.length) return [];
    const headers = splitCsvLine(lines[0]).map(h => h.toLowerCase());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCsvLine(lines[i]);
      if (cols.every(c => !c)) continue;
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = cols[idx] !== undefined ? cols[idx] : ''; });
      rows.push(mapRowUniversal(obj, 'csv', defaultSourceNote, kindHint));
    }
    return rows;
  }

  // Cleans up a parsed line fragment: strips PDF-decoding mojibake/control characters and
  // collapses whitespace, since this text ends up as an editable item/description name.
  function cleanFragment(s) {
    return String(s || '').replace(/[\uFFFD\u0000-\u001F]/g, ' ').replace(/\s{2,}/g, ' ').trim();
  }

  const SKIPPABLE_LINE_RE = /^(page \d+(\s*of\s*\d+)?|subtotal|total|gst|vat|tax invoice|invoice(\s*(no\.?|number))?|quote(\s*(no\.?|number))?|description|qty|quantity|category\s+sub\s*category\s+item\s*description?)$/i;

  // Unmarked decimals are considered separately, only at the end of an invoice-like line.
  const AMOUNT_RE = /(?:(?:NZ|AU?|CA?|US)?[$£€]\s?\d[\d,]*(?:\.\d{1,2})?)|(?:\b\d[\d,]*(?:\.\d{1,2})?\s?(?:USD|NZD|AUD|GBP|EUR|CAD)\b)|(?:\b(?:USD|NZD|AUD|GBP|EUR|CAD)\s?\d[\d,]*(?:\.\d{1,2})?\b)/gi;
  // A line that is *only* a currency amount, with nothing else on it - used to fold a stray
  // price line onto the preceding title/description line (common in div/card-based listing
  // layouts once stripped to text, where the title and price sit in separate sibling elements).
  const STANDALONE_AMOUNT_RE = new RegExp('^(?:' + AMOUNT_RE.source + ')$', 'i');

  // Parses free-form text (PDF text / plain pasted text) into candidate rows. Lines with a
  // recognizable currency amount use the text before it as the item/description and the amount
  // as RRP/cost; unpriced candidates remain editable and are flagged for pricing during review.
  function parseFreeText(text, defaultSourceNote, kindHint) {
    const rawLines = text.split(/\r?\n/).map(l => cleanFragment(l)).filter(Boolean);
    const lines = [];
    rawLines.forEach(l => {
      if (STANDALONE_AMOUNT_RE.test(l) && lines.length) lines[lines.length - 1] += ' ' + l;
      else lines.push(l);
    });
    const rows = [];
    const dateRe = /\b(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4})\b/i;
    let prevLine = '';
    let sectionKind = kindHint;
    lines.forEach(rawLine => {
      // Strip any URL out of the line itself (it's already captured separately as the source),
      // so it doesn't clutter the auto-derived item name.
      const line = cleanFragment(rawLine.replace(URL_RE, ''));
      if (!line || line.length < 2 || line === prevLine) return;
      prevLine = line;
      if (SKIPPABLE_LINE_RE.test(line)) return;
      if (/Owners Initial|^INVENTORY\b|^Spares and Extras for Schedule|^\d+$|^Category\s+Sub/i.test(line)) return;
      if (/^(vessel name|make|model|year|length|beam|draft|air height|displacement|hull material|deck material|keel type|designer|builder|HIN|place of registration|registration|tax status|lying)\b/i.test(line)) return;
      if (/^(engine spares package|spare parts pack|spares packages?)\s*:?\s*$/i.test(line)) {
        sectionKind = 'spare';
        return;
      }
      if (/^(generator|watermaker|engine|anchor and mooring|deck hardware|winches|hull|galley|electronics|batteries|electrical equipment|sail inventory|safety equipment|ground tackle|deck gear & accessories|miscellaneous|accommodation|bathrooms)\s*$/i.test(line)) {
        sectionKind = kindHint;
        return;
      }

      const amounts = /\b(circa|investment|past \d+ years)\b/i.test(line) ? null
        : (line.match(AMOUNT_RE)
          || line.match(/(?<![\w./])\d[\d,]*\.\d{2}(?![\w./])(?=\s*(?:$|\d[\d,]*\.\d{2}\s*$))/g));
      let name, rrp = 0, installCost = 0;
      let priceInfo;
      if (amounts && amounts.length) {
        const firstIdx = line.indexOf(amounts[0]);
        name = cleanFragment(line.slice(0, firstIdx).replace(/[-:|\t]+$/, ''));
        if (!name) name = cleanFragment(line.replace(amounts[0], ''));
        const price = importedPrice(amounts[0], pricing.currencyOf(line, importCurrency()));
        rrp = price.usd;
        priceInfo = price.info;
        installCost = amounts.length > 1 ? importedPrice(amounts[1], pricing.currencyOf(line, importCurrency())).usd : 0;
      } else {
        name = line;
      }
      if (!name) name = 'Unnamed item';
      const category = guessCategory(name);
      const dateMatch = line.match(dateRe);
      let kind = classifyKind(name + ' ' + category);
      if (sectionKind === 'spare') kind = 'spare';
      else if (kind === 'equipment' && sectionKind) kind = sectionKind;
      rows.push({
        id: uid(), kind, name, category, rrp, installCost,
        installDate: dateMatch ? parseDateFlexible(dateMatch[0]) : '',
        lifeYears: defaultLifeForCategory(category), notes: '', ideal: false, source: 'parsed',
        sourceNote: defaultSourceNote || '', priceInfo, originalText: line
      });
    });
    return rows;
  }

  const URL_RE = /\bhttps?:\/\/[^\s<>"')]+/ig;

  // Finds the first http(s) URL in pasted text, so provenance can be worked out automatically
  // (e.g. a Facebook post or forum thread link included in what was copied) instead of asking.
  function findUrlInText(text) {
    const m = String(text || '').match(URL_RE);
    return m ? m[0].replace(/[.,;:]+$/, '') : '';
  }

  // Detects whether pasted content is markup (a copied HTML snippet, or a whole page's source
  // pasted in via "View Page Source") rather than plain visible text, so it can be stripped down
  // to readable text first instead of being fed straight into the line-based text parser (which
  // would otherwise choke on tags, inline scripts/styles and attributes).
  function looksLikeHtml(str) {
    const s = String(str || '');
    if (/<!doctype html|<html[\s>]|<body[\s>]|<head[\s>]/i.test(s)) return true;
    const tagMatches = s.match(/<\/?[a-z][a-z0-9]*(?:\s[^<>]*)?>/gi);
    return !!tagMatches && tagMatches.length >= 8;
  }

  // Strips a pasted HTML document/snippet down to its visible text, dropping non-visible
  // elements (script/style/head/etc.) and inserting line breaks after block-level elements so
  // rows of a listing/table don't all run together into one unusable line.
  function stripHtmlToText(html) {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      doc.querySelectorAll('script, style, noscript, svg, head, template').forEach(el => el.remove());
      const BLOCK_TAGS = new Set(['DIV', 'P', 'LI', 'TR', 'TD', 'TH', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
        'BR', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'UL', 'OL', 'TABLE', 'ASIDE']);
      doc.body.querySelectorAll('*').forEach(el => {
        if (BLOCK_TAGS.has(el.tagName)) el.insertAdjacentText('afterend', '\n');
      });
      return doc.body.textContent || '';
    } catch (e) {
      return html;
    }
  }

  function parsePastedContent(raw) {
    if (!raw || !raw.trim()) return [];
    const isHtmlDoc = looksLikeHtml(raw);
    // For a full page's HTML source, prefer its canonical URL/title over the first URL anywhere
    // in the markup (which is often a script/stylesheet/CDN link, not the page itself).
    let defaultSourceNote = '';
    if (isHtmlDoc) {
      try {
        const doc = new DOMParser().parseFromString(raw, 'text/html');
        const canonical = doc.querySelector('link[rel="canonical"]')?.href
          || doc.querySelector('meta[property="og:url"]')?.content
          || '';
        defaultSourceNote = canonical || doc.title || findUrlInText(raw);
      } catch (e) { defaultSourceNote = findUrlInText(raw); }
    } else {
      defaultSourceNote = findUrlInText(raw);
    }

    if (/<table[\s>]/i.test(raw)) {
      try {
        const doc = new DOMParser().parseFromString(raw, 'text/html');
        const table = doc.querySelector('table');
        if (table) {
          const trs = Array.from(table.querySelectorAll('tr'));
          if (trs.length > 1) {
            const headerCells = Array.from(trs[0].querySelectorAll('th,td')).map(c => c.textContent.trim());
            const rows = [];
            trs.slice(1).forEach(tr => {
              const cells = Array.from(tr.querySelectorAll('td,th')).map(c => c.textContent.trim());
              if (!cells.some(c => c)) return;
              const obj = {};
              headerCells.forEach((h, i) => { obj[h] = cells[i] || ''; });
              rows.push(mapRowUniversal(obj, 'webpage', defaultSourceNote));
            });
            if (rows.length) return rows;
          }
        }
      } catch (e) { /* fall through to plain text parsing */ }
    }

    if (raw.includes('\t')) {
      const lines = raw.split(/\r?\n/).filter(l => l.trim());
      if (lines.length > 1) {
        const headers = lines[0].split('\t').map(h => h.trim());
        const looksLikeHeader = headers.some(h => /name|item|rrp|price|cost|category|date|description/i.test(h));
        const rows = [];
        const startIdx = looksLikeHeader ? 1 : 0;
        for (let i = startIdx; i < lines.length; i++) {
          if (looksLikeHeader) {
            const cells = lines[i].split('\t').map(c => c.trim());
            const obj = {};
            headers.forEach((h, idx) => { obj[h] = cells[idx] || ''; });
            rows.push(mapRowUniversal(obj, 'webpage', defaultSourceNote));
          } else {
            rows.push(...parseFreeText(lines[i], defaultSourceNote));
          }
        }
        if (rows.length) return rows;
      }
    }

    return parseFreeText(isHtmlDoc ? stripHtmlToText(raw) : raw, defaultSourceNote);
  }

  async function ensurePdfJs() {
    if (window.pdfjsLib) return window.pdfjsLib;
    let mod;
    try {
      mod = await import(/* webpackIgnore: true */ PDFJS_MODULE_URL);
    } catch (e) {
      throw new Error('PDF reader library failed to load (no internet connection?)');
    }
    mod.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
    window.pdfjsLib = mod;
    return mod;
  }

  async function parsePdfFile(file, defaultSourceNote, kindHint) {
    const pdfjsLib = await ensurePdfJs();
    const buffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: buffer });
    const pdf = await loadingTask.promise;
    try {
      let fullText = '';
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        fullText += pdfTextLines(content.items).join('\n') + '\n';
      }
      if (!fullText.trim()) {
        throw new Error('No selectable text found in this PDF (it may be a scanned image) - try manual entry instead.');
      }
      return parseFreeText(fullText, defaultSourceNote, kindHint);
    } finally {
      await loadingTask.destroy();
    }
  }

  function pdfTextLines(items) {
    const groups = [];
    items.filter(it => it.str?.trim()).sort((a, b) => b.transform[5] - a.transform[5]).forEach(it => {
      const y = it.transform[5];
      let group = groups.find(g => Math.abs(g.y - y) <= 2);
      if (!group) { group = { y, items: [] }; groups.push(group); }
      group.items.push(it);
    });
    return groups.map(group => group.items.sort((a, b) => a.transform[4] - b.transform[4]).map(it => it.str).join(' '));
  }

  function escapeRegExp(s) {
    return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Strips accents/diacritics so folder-name matching isn't thrown off by minor spelling
  // differences (e.g. a folder typed as "Helia" should still match the model name "Hélia").
  function foldDiacritics(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  // Works out this specific real boat's own name (e.g. "Seaduction") from a folder it was
  // imported from (e.g. "FP Saona 47 Seaduction") by stripping the make/model/length portion and
  // keeping whatever's left over - per the user's own description of how these folders are named.
  function extractBoatNicknameFromFolderName(folderName, boat) {
    if (!folderName || !boat) return '';
    // Normalize hyphens/underscores to spaces *before* matching the manufacturer/model name, so
    // "Saona-47-Sea-Esta" matches "Saona 47" just as well as "Saona 47 Sea Esta" would.
    let remainder = ' ' + foldDiacritics(folderName).replace(/[-_]+/g, ' ') + ' ';
    const manufacturer = foldDiacritics(boat.manufacturer || '');
    const manufWords = manufacturer.split(/\s+/).filter(Boolean);
    const manufAbbrev = manufWords.map(w => w[0]).join('');
    [manufacturer, manufAbbrev, foldDiacritics(boat.name || '')].forEach(token => {
      if (token) remainder = remainder.replace(new RegExp('\\b' + escapeRegExp(token) + '\\b', 'ig'), ' ');
    });
    // Fallback in case the model token didn't match exactly (different spacing): strip a
    // standalone length-like number (e.g. "47", "45ft") that's still left over.
    remainder = remainder.replace(/\b\d{2,3}(?:\.\d+)?\s*(?:ft|')?\b/i, ' ');
    remainder = remainder.replace(/\s{2,}/g, ' ').trim();
    return remainder;
  }

  async function handleFileInput(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const targetBoat = getSlotBoat(equipmentState.activeSlot);
    if (!targetBoat) { showToastLocal('Select an import target boat first.'); e.target.value = ''; return; }
    await priceDatabaseReady;
    const allRows = [];
    const failed = [];
    const photoIssues = [];
    const hasPDF = files.some(file => /\.pdf$/i.test(file.name) || file.type === 'application/pdf');
    try {
      for (const file of files) {
        // Browsers never expose a file input's real folder path (for user privacy/security), so
        // the best available provenance is the file's name, or its relative path if a folder of
        // files was selected (webkitRelativePath, e.g. "SurveyDocs/engine-quote.pdf").
        const fileSourceNote = file.webkitRelativePath || file.name;
        const kindHint = kindHintFromFilename(file.name);
        try {
          let rows = [];
          if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
            if (files.length > 1) showToastLocal(`Parsing ${file.name}…`);
            else showToastLocal('Parsing PDF…');
            rows = await parsePdfFile(file, fileSourceNote, kindHint);
          } else if (/\.csv$/i.test(file.name) || file.type === 'text/csv') {
            const text = await file.text();
            rows = parseCSV(text, fileSourceNote, kindHint);
          } else continue;
          allRows.push(...rows);
          if (!rows.length) failed.push(`${file.name} (empty)`);
          if (rows.length && (/\.pdf$/i.test(file.name) || file.type === 'application/pdf')) {
            try {
              const note = await window.BOAT_PHOTOS.discover(file, targetBoat.id);
              if (note) photoIssues.push(note);
            } catch (err) {
              photoIssues.push(`${file.name}: ${err.message}`);
              console.error('Local boat photo discovery failed.', err);
            }
          }
        } catch (err) {
          failed.push(`${file.name} (${err && err.message ? err.message : 'error'})`);
        }
      }
      if (!allRows.length) {
        showToastLocal(failed.length ? `Could not parse any rows: ${failed.join('; ')}` : 'No rows found in those file(s). Try manual entry instead.');
        return;
      }
      if (hasPDF) {
        saveImportedRows(allRows.map(enrichPrice), targetBoat.id);
        renderAll();
      } else stageRows(allRows, targetBoat.id);
      // If a whole folder was selected (webkitRelativePath present), work out this specific real
      // boat's own name from the folder it lives in and auto-fill it (without clobbering a name
      // already set, whether auto-detected earlier or typed in manually).
      const folderFile = files.find(f => f.webkitRelativePath);
      if (folderFile) {
        const folderName = folderFile.webkitRelativePath.split('/')[0];
        const activeBoat = targetBoat;
        if (activeBoat && !equipmentState.nicknames[activeBoat.id]) {
          const nickname = extractBoatNicknameFromFolderName(folderName, activeBoat);
          if (nickname) {
            equipmentState.nicknames[activeBoat.id] = nickname;
            saveNicknames();
            renderAll();
          }
        }
      }
      const parts = [`${allRows.length} row${allRows.length === 1 ? '' : 's'} ${hasPDF ? 'saved automatically' : 'ready to add'} to ${targetBoat.name}. Review classifications, prices and duplicate mentions in the saved tables.`];
      if (failed.length) parts.push(`${failed.length} file(s) had issues: ${failed.join('; ')}`);
      if (photoIssues.length) parts.push(`Photos: ${[...new Set(photoIssues)].join('; ')}`);
      elements.importStatus.textContent = parts.join(' — ');
      showToastLocal(parts.join(' — '));
    } finally {
      e.target.value = '';
    }
  }

  // ---------------------------------------------------------------------
  // Staging (review-before-commit) table
  // ---------------------------------------------------------------------
  const KIND_LABELS = { equipment: 'Equipment', spare: 'Spare', maintenance: 'Maintenance' };

  function syncImportTarget() {
    const boatId = getSlotBoat(equipmentState.activeSlot)?.id || null;
    if (boatId === equipmentState.importBoatId) return;
    if (equipmentState.importBoatId) {
      equipmentState.importDrafts[equipmentState.importBoatId] = {
        rows: equipmentState.pendingImport,
        collapsed: equipmentState.stagingCollapsed,
        pastedText: elements.pasteArea.value
      };
    }
    const draft = equipmentState.importDrafts[boatId];
    equipmentState.importBoatId = boatId;
    equipmentState.pendingImport = draft?.rows || [];
    equipmentState.stagingCollapsed = draft?.collapsed || false;
    elements.pasteArea.value = draft?.pastedText || '';
    elements.fileInput.value = '';
    elements.folderInput.value = '';
  }

  function stageRows(rows, boatId = getSlotBoat(equipmentState.activeSlot)?.id) {
    if (!boatId) { showToastLocal('Select an import target boat first.'); return; }
    syncImportTarget();
    const staged = rows.map(r => ({ ...enrichPrice(r), _checked: true }));
    if (boatId !== equipmentState.importBoatId) {
      equipmentState.importDrafts[boatId] = { rows: staged, collapsed: false, pastedText: '' };
      renderAll();
      return;
    }
    equipmentState.pendingImport = staged;
    equipmentState.stagingCollapsed = false; // always show a freshly parsed batch, even if a previous one was minimized
    renderAll();
  }

  // Keeps the staging table's minimize/expand state in sync with the toggle button - called on
  // every renderStaging() so a mid-review collapse isn't lost when rows are edited/re-rendered.
  function applyStagingCollapsedState() {
    if (!elements.stagingWrap || !elements.stagingToggleBtn) return;
    const collapsed = equipmentState.stagingCollapsed;
    elements.stagingWrap.classList.toggle('is-collapsed', collapsed);
    elements.stagingToggleBtn.textContent = collapsed ? '▸ Expand' : '▾ Minimize';
    elements.stagingToggleBtn.setAttribute('aria-expanded', String(!collapsed));
    elements.stagingToggleBtn.title = collapsed
      ? 'Expand the parsed rows table back open'
      : 'Minimize the parsed rows table (keeps the buttons above visible)';
  }

  function renderStaging() {
    const rows = equipmentState.pendingImport;
    elements.stagingWrap.classList.toggle('is-hidden', rows.length === 0);
    applyStagingCollapsedState();
    const selected = rows.filter(r => r._checked).length;
    elements.commitBtn.textContent = `Add ${selected} checked row${selected === 1 ? '' : 's'} to boat`;
    elements.commitBtn.disabled = selected === 0;
    if (!rows.length) { elements.stagingTable.innerHTML = ''; elements.stagingCount.textContent = ''; return; }
    const counts = rows.reduce((acc, r) => { acc[r.kind] = (acc[r.kind] || 0) + 1; return acc; }, {});
    const countSummary = ['equipment', 'spare', 'maintenance']
      .filter(k => counts[k])
      .map(k => `${counts[k]} ${KIND_LABELS[k].toLowerCase()}`)
      .join(', ');
    const allChecked = rows.every(r => r._checked);
    const unpriced = rows.filter(r => !(r.rrp > 0)).length;
    const targetName = getSlotBoat(equipmentState.activeSlot)?.name || `Boat ${equipmentState.activeSlot}`;
    elements.stagingCount.textContent = `${rows.length} imported row${rows.length === 1 ? '' : 's'} awaiting review — NOT ADDED to ${targetName} yet (${countSummary}) — ${selected} checked; ${unpriced} need a price; all amounts USD`;

    // One unified table for all 3 kinds: a per-row "Kind" dropdown lets the user correct the
    // auto-classification. RRP doubles as the maintenance "Cost" amount and Install Date doubles
    // as the maintenance "Date" - this keeps a single consistent layout regardless of row kind.
    elements.stagingTable.innerHTML = `
      <thead><tr>
        <th><input type="checkbox" id="equipmentStagingAllToggle" ${allChecked ? 'checked' : ''}></th>
        <th>Kind</th><th>Item / Description</th><th>Category</th><th>RRP / Cost (USD)</th><th>Install Cost (USD)</th><th>Date</th><th>Life (yrs)</th><th>Hours</th><th>Life (hrs)</th>
      </tr></thead>
      <tbody>${rows.map((r, idx) => `
        <tr>
          <td><input type="checkbox" data-field="_checked" data-row-idx="${idx}" ${r._checked ? 'checked' : ''}></td>
          <td><select class="eq-input" data-field="kind" data-row-idx="${idx}">${['equipment', 'spare', 'maintenance'].map(k => `<option value="${k}" ${k === r.kind ? 'selected' : ''}>${KIND_LABELS[k]}</option>`).join('')}</select></td>
          <td><input type="text" class="eq-input eq-input-name" data-field="name" data-row-idx="${idx}" value="${escAttr(r.name)}" title="${r.sourceNote ? 'Source: ' + escAttr(r.sourceNote) : ''}"></td>
          <td><select class="eq-input" data-field="category" data-row-idx="${idx}">${CATEGORY_OPTIONS.map(c => `<option value="${escAttr(c)}" ${c === r.category ? 'selected' : ''}>${escAttr(c)}</option>`).join('')}</select></td>
          <td><input type="number" min="0" step="0.01" class="eq-input eq-input-num" data-field="rrp" data-row-idx="${idx}" value="${r.rrp || ''}" placeholder="Needs price">${renderPriceInfo(r)}${renderQuoteEditor(r, `data-row-idx="${idx}"`)}</td>
          <td><input type="number" min="0" step="1" class="eq-input eq-input-num" data-field="installCost" data-row-idx="${idx}" value="${r.installCost || 0}"></td>
          <td><input type="date" class="eq-input" data-field="installDate" data-row-idx="${idx}" value="${r.installDate || ''}"></td>
          <td><input type="number" min="0" step="0.5" class="eq-input eq-input-num" data-field="lifeYears" data-row-idx="${idx}" value="${r.lifeYears || 0}"></td>
          <td><input type="number" min="0" step="1" class="eq-input eq-input-num" data-field="hours" data-row-idx="${idx}" value="${r.hours || ''}" title="Engine/generator running hours, if known"></td>
          <td><input type="number" min="0" step="100" class="eq-input eq-input-num" data-field="lifeHours" data-row-idx="${idx}" value="${r.lifeHours || ''}" title="Running-hours life expectancy (engines/generators) — takes over from calendar age when set"></td>
        </tr>`).join('')}</tbody>`;
    const allToggle = document.getElementById('equipmentStagingAllToggle');
    if (allToggle) {
      allToggle.indeterminate = selected > 0 && !allChecked;
      allToggle.addEventListener('change', () => {
        equipmentState.pendingImport.forEach(r => { r._checked = allToggle.checked; });
        renderStaging();
      });
    }
  }

  function onStagingChange(e) {
    const t = e.target;
    if (t.dataset.rowIdx === undefined) return;
    const row = equipmentState.pendingImport[parseInt(t.dataset.rowIdx, 10)];
    if (!row) return;
    const field = t.dataset.field;
    if (field === '_checked') row._checked = t.checked;
    else if (field === 'rrp' || field === 'installCost' || field === 'lifeYears' || field === 'hours' || field === 'lifeHours') row[field] = parseFloat(t.value) || 0;
    else row[field] = t.value;
    if (field === '_checked') {
      renderStaging();
    }
    if (field === 'rrp') row.priceInfo = { status: 'manual' };
    if (field === 'name' && row.priceInfo?.status === 'estimate') {
      row.rrp = 0; delete row.priceInfo; enrichPrice(row);
    }
    if (field === 'kind' && row.kind === 'maintenance' && row.priceInfo?.status === 'estimate') {
      row.rrp = 0; delete row.priceInfo;
    }
    if (['rrp', 'name', 'kind'].includes(field)) renderStaging();
  }

  function saveImportedRows(rows, boatId) {
    let equipCount = 0, maintCount = 0;
    rows.forEach(r => {
      if (r.kind === 'maintenance') {
        if (!equipmentState.maintenanceLog[boatId]) equipmentState.maintenanceLog[boatId] = [];
        equipmentState.maintenanceLog[boatId].push({
          id: r.id, date: r.installDate, description: r.name, cost: r.rrp,
          linkedItemId: '', source: r.source, sourceNote: r.sourceNote, priceInfo: r.priceInfo
        });
        maintCount++;
      } else {
        if (!equipmentState.data[boatId]) equipmentState.data[boatId] = [];
        const item = { ...r };
        delete item._checked;
        equipmentState.data[boatId].push(item);
        equipCount++;
      }
    });
    if (maintCount) saveMaintenanceLog();
    if (equipCount) saveData();
    return { equipCount, maintCount };
  }

  function commitStaged() {
    const slot = equipmentState.activeSlot;
    const boat = getSlotBoat(slot);
    if (!boat) { showToastLocal(`Select a boat in Boat ${slot} above first.`); return; }
    if (boat.id !== equipmentState.importBoatId) {
      syncImportTarget();
      renderStaging();
      showToastLocal('Import target changed. Review this boat’s rows before adding.');
      return;
    }
    const checked = equipmentState.pendingImport.filter(r => r._checked);
    if (!checked.length) { showToastLocal('No rows are checked to add.'); return; }
    const { equipCount, maintCount } = saveImportedRows(checked, boat.id);

    equipmentState.pendingImport = equipmentState.pendingImport.filter(r => !r._checked);
    renderStaging();
    renderAll();
    const parts = [];
    if (equipCount) parts.push(`${equipCount} equipment/spare item(s)`);
    if (maintCount) parts.push(`${maintCount} maintenance entr${maintCount === 1 ? 'y' : 'ies'}`);
    showToastLocal(`Added ${parts.join(' and ')} to ${boat.manufacturer} ${boat.name}.`);
  }

  function discardStaged() {
    equipmentState.pendingImport = [];
    renderAll();
  }

  function addManualItem() {
    const slot = equipmentState.activeSlot;
    const boat = getSlotBoat(slot);
    if (!boat) { showToastLocal(`Select a boat in Boat ${slot} above first.`); return; }
    const kind = equipmentState.activeKind;
    const sourceNote = '';

    if (kind === 'maintenance') {
      if (!equipmentState.maintenanceLog[boat.id]) equipmentState.maintenanceLog[boat.id] = [];
      equipmentState.maintenanceLog[boat.id].push({
        id: uid(), date: '', description: 'New maintenance entry', cost: 0, linkedItemId: '', source: 'manual', sourceNote
      });
      saveMaintenanceLog();
    } else {
      if (!equipmentState.data[boat.id]) equipmentState.data[boat.id] = [];
      equipmentState.data[boat.id].push({
        id: uid(), kind, name: kind === 'spare' ? 'New spare' : 'New item', category: 'Other', rrp: 0, installCost: 0,
        installDate: '', lifeYears: defaultLifeForCategory('Other'), hours: '', lifeHours: defaultLifeHoursForCategory('Other'),
        notes: '', ideal: false, source: 'manual', sourceNote
      });
      saveData();
    }
    renderAll();
  }

  // ---------------------------------------------------------------------
  // Comparative Price engine: Ideal/Model Boat override + automatic best-in-class benchmark
  // ---------------------------------------------------------------------

  // Builds the reference ("what a fully-equipped boat looks like") spec used to compute each
  // boat's Comparative Price. By default this auto-picks the current-highest-value item in each
  // category across whichever boats are presently in the 3 comparison slots, so every boat gets a
  // live Comparative Price without any setup. A manually-designated "Model Boat" and/or any
  // individually-starred (★) item take precedence over the automatic pick for that category.
  function buildComparativeReference(compareBoatIds) {
    const now = new Date();
    const autoByCategory = {};
    compareBoatIds.forEach(bid => {
      getComparableItems(bid).forEach(item => {
        const currentValue = computeItemMetrics(item, now).currentValue;
        const cat = item.category;
        if (!autoByCategory[cat] || currentValue > autoByCategory[cat]._currentValue) {
          autoByCategory[cat] = { ...item, boatId: bid, _currentValue: currentValue };
        }
      });
    });

    const starredByCategory = {};
    const starred = [];
    Object.keys(equipmentState.data).forEach(bid => {
      getComparableItems(bid).forEach(item => {
        if (item.ideal) {
          const entry = { ...item, boatId: bid };
          starred.push(entry);
          (starredByCategory[item.category] = starredByCategory[item.category] || []).push(entry);
        }
      });
    });

    let modelItems = [];
    if (equipmentState.modelBoatId && equipmentState.data[equipmentState.modelBoatId]) {
      modelItems = getComparableItems(equipmentState.modelBoatId)
        .filter(item => !starredByCategory[item.category])
        .map(item => ({ ...item, boatId: equipmentState.modelBoatId }));
    }

    // Explicit overrides (model boat / stars) win per category; auto fills every other category.
    const categoriesCovered = new Set([...modelItems.map(i => i.category), ...starred.map(i => i.category)]);
    const autoItems = Object.values(autoByCategory).filter(i => !categoriesCovered.has(i.category));

    return [...autoItems, ...modelItems, ...starred];
  }

  // Decides whether a boat's own existing item in a category should be flagged as something
  // worth budgeting to replace: only when it's genuinely overdue (past its age or running-hours
  // use-by date) - never simply because another boat's equivalent happens to cost more. A
  // perfectly serviceable (if cheaper, older-spec, or lower-hours) engine or other big-ticket
  // item is not something we're going to replace just to "match" another boat.
  function computeComparativeGap(boatId, reference) {
    const items = getComparableItems(boatId);
    const now = new Date();
    let matched = 0;
    const gaps = [];
    let upgradeCost = 0;
    reference.forEach(refItem => {
      const refTotal = itemTotal(refItem);
      if (refItem.boatId === boatId) { matched++; return; }
      const candidates = items.filter(i => i.category === refItem.category)
        .sort((a, b) => itemTotal(b) - itemTotal(a));

      if (!candidates.length) {
        // Genuinely missing this category entirely - a real equipment gap, not a "replace an
        // existing item" question.
        upgradeCost += refTotal;
        gaps.push({ category: refItem.category, name: refItem.name, cost: refTotal, reason: 'missing' });
        return;
      }

      const best = candidates[0];
      const bestMetrics = computeItemMetrics(best, now);
      if (bestMetrics.status !== 'overdue') {
        // Already has a working item in this category that isn't past its use-by date - don't
        // recommend replacing/upgrading it just because another boat's costs more.
        matched++;
        return;
      }

      const candidateTotal = itemTotal(best);
      const cost = Math.max(0, refTotal - candidateTotal);
      if (cost <= 0) {
        matched++;
      } else {
        upgradeCost += cost;
        gaps.push({ category: refItem.category, name: refItem.name, cost, reason: 'overdue' });
      }
    });
    return { matched, gaps, upgradeCost };
  }

  // Full per-boat financial breakdown: depreciation, My Buy Price, and the headline Comparative Price.
  function computeBoatFinancials(boatId, boat) {
    const now = new Date();
    const items = getComparableItems(boatId);
    const rows = items.map(item => ({ item, metrics: computeItemMetrics(item, now) }));
    const totalAsNew = rows.reduce((s, r) => s + r.metrics.totalCost, 0);
    const totalAccrued = rows.reduce((s, r) => s + r.metrics.accruedDepreciation, 0);
    const askingPrice = getAskingPrice(boatId, boat);
    const myBuyPrice = Math.max(0, askingPrice - totalAccrued);

    const reference = buildComparativeReference(getCompareBoatIds());
    const gapInfo = reference.length ? computeComparativeGap(boatId, reference) : { matched: 0, gaps: [], upgradeCost: 0 };
    const comparativePrice = myBuyPrice + gapInfo.upgradeCost;

    return { rows, totalAsNew, totalAccrued, askingPrice, myBuyPrice, gapInfo, comparativePrice, referenceCount: reference.length };
  }

  // ---------------------------------------------------------------------
  // Charter Boat heuristic
  // Flags boats whose actual (not model-range) spec looks like a typical charter fit-out: modest
  // solar/house-bank capacity, a small tender outboard, more cabins (to sleep paying guests), a
  // non-lithium battery bank, and no high-performance downwind sail (Code 0/D, gennaker,
  // spinnaker, parasailor) - charter operators rarely fit these. This is only a confidence
  // indicator, never exclusionary: "I do not want a charter boat unless the price is good and the
  // maintenance is very good" - so a flagged boat is only worth a closer look if it's priced well
  // below its Comparative Price AND has a solid, well-documented maintenance history.
  // ---------------------------------------------------------------------
  const CHARTER_SOLAR_WATTS_MAX = 2000;
  const CHARTER_BATTERY_AH_MAX = 1000; // normalized to 12V-equivalent
  const CHARTER_TENDER_HP_MAX = 10;
  const CHARTER_CABINS_MIN = 4;

  const SOLAR_WATT_PATTERN = /(\d[\d,]*(?:\.\d+)?)\s*w(?:att)?s?\b/i;
  const BATTERY_AH_PATTERN = /(\d[\d,]*(?:\.\d+)?)\s*a(?:mp)?[\s-]?h(?:ours?)?\b/i;
  const BATTERY_VOLT_RE = /\b(12|24|48)\s*v(?:olt)?s?\b/i;
  const TENDER_HP_RE = /(\d[\d,]*(?:\.\d+)?)\s*hp\b/i;
  const LITHIUM_RE = /lithium|life ?po ?4|li[- ]?ion/i;
  const NON_LITHIUM_RE = /\bagm\b|\bgel\b|lead[- ]?acid|flooded|wet[- ]?cell/i;
  // A parasailor or screecher (both specialised light-air/downwind reaching sails, like a
  // Code 0/D/gennaker/spinnaker) is also unlikely to be found on a charter boat.
  const CHARTER_UNLIKELY_SAIL_RE = /code\s?0\b|code\s?zero|code\s?d\b|gennaker|spinnaker|parasailor|screecher/i;

  // Sums every numeric match of a (non-global) pattern found in text, e.g. "2x 200W + 1x 100W"
  // -> 500. A fresh global RegExp is built per call so callers never have to worry about
  // RegExp.lastIndex state leaking between invocations.
  function sumPatternMatches(text, basePattern) {
    const re = new RegExp(basePattern.source, basePattern.flags.includes('g') ? basePattern.flags : basePattern.flags + 'g');
    let total = 0, m;
    while ((m = re.exec(text))) total += parseFloat(String(m[1]).replace(/,/g, '')) || 0;
    return total;
  }

  function extractSolarWattsTotal(items) {
    const solarItems = items.filter(i => i.category === 'Solar & Power Mgmt' && /solar/i.test(i.name));
    if (!solarItems.length) return null;
    const total = solarItems.reduce((s, i) => s + sumPatternMatches(i.name, SOLAR_WATT_PATTERN), 0);
    return total > 0 ? total : null;
  }

  function extractBatteryAh12vTotal(items) {
    const battItems = items.filter(i => i.category === 'Electrical & Batteries' && BATTERY_AH_PATTERN.test(i.name));
    if (!battItems.length) return null;
    let total = 0;
    battItems.forEach(i => {
      const ah = sumPatternMatches(i.name, BATTERY_AH_PATTERN);
      const voltMatch = i.name.match(BATTERY_VOLT_RE);
      const volts = voltMatch ? parseFloat(voltMatch[1]) : 12;
      total += ah * (volts / 12);
    });
    return total > 0 ? total : null;
  }

  function extractTenderHpMax(items) {
    const tenderItems = items.filter(i => i.category === 'Tender & Outboard' && TENDER_HP_RE.test(i.name));
    if (!tenderItems.length) return null;
    let maxHp = 0;
    tenderItems.forEach(i => {
      const m = i.name.match(TENDER_HP_RE);
      if (m) maxHp = Math.max(maxHp, parseFloat(m[1]) || 0);
    });
    return maxHp > 0 ? maxHp : null;
  }

  function batteryLithiumStatus(items) {
    const battItems = items.filter(i => i.category === 'Electrical & Batteries');
    if (!battItems.length) return 'unknown';
    if (battItems.some(i => LITHIUM_RE.test(i.name) || LITHIUM_RE.test(i.notes || ''))) return 'lithium';
    if (battItems.some(i => NON_LITHIUM_RE.test(i.name) || NON_LITHIUM_RE.test(i.notes || ''))) return 'non-lithium';
    return 'unknown';
  }

  function codeSailStatus(items) {
    const sailItems = items.filter(i => i.category === 'Sails');
    if (!sailItems.length) return 'unknown';
    return sailItems.some(i => CHARTER_UNLIKELY_SAIL_RE.test(i.name)) ? 'has-code-sail' : 'no-code-sail';
  }

  function computeCharterAssessment(boatId, items, finance, maintLog, overdueCount, peerComparativePrices) {
    const cabins = equipmentState.cabins[boatId] || 0;
    const solarWatts = extractSolarWattsTotal(items);
    const batteryAh = extractBatteryAh12vTotal(items);
    const tenderHp = extractTenderHpMax(items);
    const lithiumStatus = batteryLithiumStatus(items);
    const sailStatus = codeSailStatus(items);

    const criteria = [];
    if (solarWatts != null) criteria.push({ label: `Solar ${Math.round(solarWatts)}W (charter boats usually < ${CHARTER_SOLAR_WATTS_MAX}W)`, match: solarWatts < CHARTER_SOLAR_WATTS_MAX });
    if (batteryAh != null) criteria.push({ label: `House bank ~${Math.round(batteryAh)}Ah @ 12V (charter boats usually < ${CHARTER_BATTERY_AH_MAX}Ah)`, match: batteryAh < CHARTER_BATTERY_AH_MAX });
    if (tenderHp != null) criteria.push({ label: `Tender ${tenderHp}hp (charter boats usually < ${CHARTER_TENDER_HP_MAX}hp)`, match: tenderHp < CHARTER_TENDER_HP_MAX });
    if (cabins > 0) criteria.push({ label: `${cabins} cabins (charter boats usually ${CHARTER_CABINS_MIN}+)`, match: cabins >= CHARTER_CABINS_MIN });
    if (lithiumStatus !== 'unknown') criteria.push({ label: lithiumStatus === 'lithium' ? 'Lithium house bank' : 'Non-lithium (AGM/Gel/lead-acid) house bank', match: lithiumStatus === 'non-lithium' });
    if (sailStatus !== 'unknown') criteria.push({ label: sailStatus === 'has-code-sail' ? 'Has a Code 0/D, gennaker, spinnaker, parasailor or screecher' : 'No Code 0/D, gennaker, spinnaker, parasailor or screecher logged', match: sailStatus === 'no-code-sail' });

    const evaluated = criteria.length;
    const matches = criteria.filter(c => c.match).length;
    // Require real corroborating evidence (at least 2 data points, and at least half of what
    // could be evaluated) before flagging - a single coincidental match (e.g. just "4 cabins")
    // isn't enough on its own.
    const flagged = evaluated >= 2 && matches >= 2 && (matches / evaluated) >= 0.5;
    const stars = flagged ? Math.min(5, Math.max(1, Math.round((matches / evaluated) * 5))) : 0;

    // "Price is good" has to be judged against the *other* boats being compared, not against this
    // boat's own Comparative Price - that figure is derived from this boat's own asking price
    // (My Buy Price + cost to match), so it can never independently confirm a bargain. A price is
    // only "good" if it's meaningfully below what the other boat(s) in the comparison cost on the
    // same like-for-like Comparative Price basis.
    const others = (peerComparativePrices || []).filter(p => p > 0);
    const avgOther = others.length ? others.reduce((s, p) => s + p, 0) / others.length : 0;
    const priceIsGood = finance.comparativePrice > 0 && avgOther > 0
      && finance.comparativePrice <= avgOther * 0.95;
    const maintenanceIsGood = maintLog.length >= 5 && overdueCount === 0;

    return { criteria, evaluated, matches, flagged, stars, priceIsGood, maintenanceIsGood, cabins };
  }


  function renderReferenceSection() {
    const reference = buildComparativeReference(getCompareBoatIds());
    const referenceTotal = reference.reduce((s, i) => s + itemTotal(i), 0);
    const modelBoat = equipmentState.modelBoatId ? getBoatById(equipmentState.modelBoatId) : null;

    if (!reference.length) {
      elements.idealContent.innerHTML = `<p class="eq-empty-note">Select at least 2 boats and log their equipment to see an automatic comparison spec here, or star (★) items / click "Set as Model Boat" to set it manually.</p>`;
      return;
    }

    const overrideCount = reference.filter(i => i.ideal || i.boatId === equipmentState.modelBoatId).length;
    let html = `<div class="equipment-ideal-summary">
      <span>${modelBoat ? 'Model boat override: <strong>' + escAttr(modelBoat.manufacturer + ' ' + modelBoat.name) + '</strong>' : 'Automatic best-in-class across the boats being compared'}${overrideCount ? ` (${overrideCount} categor${overrideCount === 1 ? 'y' : 'ies'} manually overridden)` : ''}</span>
      <span>Comparison Spec Total (RRP + install): <strong>${formatMoney(referenceTotal)}</strong></span>
    </div>`;

    html += `<div class="equipment-table-container"><table class="equipment-table eq-ideal-table">
      <thead><tr><th>Item</th><th>Category</th><th>Sourced From</th><th>RRP</th><th>Install</th><th>Total</th></tr></thead>
      <tbody>${reference.map(i => {
      const sourceBoat = getBoatById(i.boatId);
      const total = itemTotal(i);
      return `<tr><td>${escAttr(i.name)}</td><td>${escAttr(i.category)}</td><td>${sourceBoat ? escAttr(sourceBoat.manufacturer + ' ' + sourceBoat.name) : '—'}</td><td>${formatMoney(i.rrp)}</td><td>${formatMoney(i.installCost)}</td><td>${formatMoney(total)}</td></tr>`;
    }).join('')}</tbody>
    </table></div>`;

    elements.idealContent.innerHTML = html;
  }

  // ---------------------------------------------------------------------
  // Per-boat equipment/spares/maintenance table + summary rendering
  // ---------------------------------------------------------------------
  function renderItemRow(boatId, item, metrics) {
    const statusLabel = { ok: 'OK', 'due-soon': 'Due soon', overdue: 'Overdue', unknown: '—' }[metrics.status];
    const ageStr = metrics.ageYears != null ? metrics.ageYears.toFixed(1) + ' yr' : '—';
    const dueStr = metrics.dueDate ? 'due ' + metrics.dueDate.toLocaleDateString() : '';
    const hoursNote = metrics.hoursFraction != null ? ` (${Math.round(metrics.hoursFraction * 100)}% of hours life used)` : '';
    return `
    <tr>
      <td class="eq-star-cell"><button type="button" class="eq-star-btn ${item.ideal ? 'active' : ''}" data-action="toggle-ideal" data-boat-id="${escAttr(boatId)}" data-item-id="${escAttr(item.id)}" title="Mark as the comparison benchmark for this category">★</button></td>
      <td><input type="text" class="eq-input eq-input-name" data-field="name" data-boat-id="${escAttr(boatId)}" data-item-id="${escAttr(item.id)}" value="${escAttr(item.name)}" title="${item.sourceNote ? 'Source: ' + escAttr(item.sourceNote) : ''}"></td>
      <td><select class="eq-input" data-field="category" data-boat-id="${escAttr(boatId)}" data-item-id="${escAttr(item.id)}">
        ${CATEGORY_OPTIONS.map(c => `<option value="${escAttr(c)}" ${c === item.category ? 'selected' : ''}>${escAttr(c)}</option>`).join('')}
      </select></td>
      <td><input type="number" min="0" step="0.01" class="eq-input eq-input-num" data-field="rrp" data-boat-id="${escAttr(boatId)}" data-item-id="${escAttr(item.id)}" value="${item.rrp || ''}" placeholder="Needs price">${renderPriceInfo(item)}${renderQuoteEditor(item, `data-boat-id="${escAttr(boatId)}" data-item-id="${escAttr(item.id)}"`)}</td>
      <td><input type="number" min="0" step="1" class="eq-input eq-input-num" data-field="installCost" data-boat-id="${escAttr(boatId)}" data-item-id="${escAttr(item.id)}" value="${item.installCost || 0}"></td>
      <td><input type="date" class="eq-input" data-field="installDate" data-boat-id="${escAttr(boatId)}" data-item-id="${escAttr(item.id)}" value="${item.installDate || ''}"></td>
      <td><input type="number" min="0" step="0.5" class="eq-input eq-input-num" data-field="lifeYears" data-boat-id="${escAttr(boatId)}" data-item-id="${escAttr(item.id)}" value="${item.lifeYears || 0}"></td>
      <td><input type="number" min="0" step="1" class="eq-input eq-input-num" data-field="hours" data-boat-id="${escAttr(boatId)}" data-item-id="${escAttr(item.id)}" value="${item.hours === '' || item.hours == null ? '' : item.hours}" title="Running hours (engines/generators) - overrides calendar age when set"></td>
      <td><input type="number" min="0" step="100" class="eq-input eq-input-num" data-field="lifeHours" data-boat-id="${escAttr(boatId)}" data-item-id="${escAttr(item.id)}" value="${item.lifeHours || 0}" title="Running-hours life expectancy"></td>
      <td class="eq-readonly">${ageStr}</td>
      <td><span class="eq-status-badge status-${metrics.status}">${statusLabel}</span>${dueStr ? `<div class="eq-due-date">${dueStr}${hoursNote}</div>` : (hoursNote ? `<div class="eq-due-date">${hoursNote}</div>` : '')}</td>
      <td class="eq-readonly eq-mono">${item.rrp > 0 ? formatMoney(metrics.currentValue) : 'Unpriced'}</td>
      <td><button type="button" class="eq-del-btn" data-action="delete-item" data-boat-id="${escAttr(boatId)}" data-item-id="${escAttr(item.id)}" title="Remove item">✕</button></td>
    </tr>`;
  }

  function renderItemsTable(boatId, items, now, emptyMessage) {
    const rows = items.map(item => ({ item, metrics: computeItemMetrics(item, now) }));
    return `
    <div class="equipment-table-container">
      <table class="equipment-table">
        <thead><tr><th>★</th><th>Item</th><th>Category</th><th>RRP (USD)</th><th>Install (USD)</th><th>Installed</th><th>Life (yrs)</th><th>Hours</th><th>Life (hrs)</th><th>Age</th><th>Status</th><th>Value Today (USD)</th><th></th></tr></thead>
        <tbody>${rows.length
        ? rows.map(r => renderItemRow(boatId, r.item, r.metrics)).join('')
        : `<tr><td colspan="13" class="eq-empty-row">${emptyMessage}</td></tr>`}</tbody>
      </table>
    </div>`;
  }

  function renderMaintenanceRow(boatId, entry) {
    return `
    <tr>
      <td><input type="date" class="eq-input" data-field="date" data-maint-boat-id="${escAttr(boatId)}" data-maint-id="${escAttr(entry.id)}" value="${entry.date || ''}"></td>
      <td><input type="text" class="eq-input eq-input-name" data-field="description" data-maint-boat-id="${escAttr(boatId)}" data-maint-id="${escAttr(entry.id)}" value="${escAttr(entry.description)}"></td>
      <td><input type="number" min="0" step="1" class="eq-input eq-input-num" data-field="cost" data-maint-boat-id="${escAttr(boatId)}" data-maint-id="${escAttr(entry.id)}" value="${entry.cost || 0}"></td>
      <td class="eq-readonly">${entry.sourceNote ? escAttr(entry.sourceNote) : '—'}</td>
      <td><button type="button" class="eq-del-btn" data-action="delete-maintenance" data-boat-id="${escAttr(boatId)}" data-maint-id="${escAttr(entry.id)}" title="Remove entry">✕</button></td>
    </tr>`;
  }

  function renderMaintenanceTable(boatId, log) {
    const total = log.reduce((s, e) => s + (Number(e.cost) || 0), 0);
    return `
    <div class="equipment-table-container">
      <table class="equipment-table">
        <thead><tr><th>Date</th><th>Description</th><th>Cost</th><th>Source</th><th></th></tr></thead>
        <tbody>${log.length
        ? log.map(e => renderMaintenanceRow(boatId, e)).join('')
        : `<tr><td colspan="5" class="eq-empty-row">No maintenance history logged yet — set "Import as" to Maintenance Log above, then import or add an entry.</td></tr>`}</tbody>
      </table>
    </div>
    <div class="eq-maintenance-total">Total logged maintenance spend: <strong>${formatMoney(total)}</strong> <span class="eq-maintenance-hint">(reference only — doesn't affect Comparative Price)</span></div>`;
  }

  function renderBoatCard(slot, boat, peerComparativePrices) {
    const boatId = boat.id;
    const now = new Date();
    const allItems = getComparableItems(boatId);
    const equipItems = allItems.filter(i => (i.kind || 'equipment') === 'equipment');
    const spareItems = allItems.filter(i => i.kind === 'spare');
    const maintLog = getMaintenanceForBoat(boatId);
    const subTab = equipmentState.cardSubTab[boatId] || 'equipment';
    const collapseKey = `${boatId}:${subTab}`;
    // Minimised by default until the user has explicitly expanded/collapsed this table at least once.
    const collapsed = collapseKey in equipmentState.collapsedTables ? !!equipmentState.collapsedTables[collapseKey] : true;
    const unpriced = allItems.filter(i => !(i.rrp > 0)).length;
    const comparisonUnpriced = getCompareBoatIds().reduce((total, id) => total + getComparableItems(id).filter(i => !(i.rrp > 0)).length, 0);
    const nickname = equipmentState.nicknames[boatId] || '';
    const pending = (equipmentState.importBoatId === boatId
      ? equipmentState.pendingImport : equipmentState.importDrafts[boatId]?.rows) || [];
    const pendingNotice = pending.length
      ? `<div class="eq-import-pending" role="status"><strong>${pending.length} imported rows awaiting review — not added yet.</strong>
          <p>Check the rows to keep, then use "Add checked rows to boat". The tables below show saved items only.</p>
          <button type="button" class="btn-icon btn-primary" data-action="review-import" data-boat-id="${escAttr(boatId)}" data-slot="${slot}">Review imported rows</button></div>` : '';

    const finance = computeBoatFinancials(boatId, boat);
    const overdue = finance.rows.filter(r => r.metrics.status === 'overdue').length;
    const dueSoon = finance.rows.filter(r => r.metrics.status === 'due-soon').length;
    const isModel = equipmentState.modelBoatId === boatId;
    const otherComparativePrices = (peerComparativePrices || []).filter(p => p.boatId !== boatId).map(p => p.comparativePrice);
    const charter = computeCharterAssessment(boatId, allItems, finance, maintLog, overdue, otherComparativePrices);

    let countText = `${allItems.length} item${allItems.length === 1 ? '' : 's'}`;
    if (overdue) countText += ` · ${overdue} overdue`;
    if (dueSoon) countText += ` · ${dueSoon} due soon`;

    const subTabsHtml = `
    <div class="equipment-card-subtabs">
      <button type="button" class="equipment-slot-tab ${subTab === 'equipment' ? 'active' : ''}" data-action="card-subtab" data-subtab="equipment" data-boat-id="${escAttr(boatId)}">Equipment (${equipItems.length})</button>
      <button type="button" class="equipment-slot-tab ${subTab === 'spare' ? 'active' : ''}" data-action="card-subtab" data-subtab="spare" data-boat-id="${escAttr(boatId)}">Spares (${spareItems.length})</button>
      <button type="button" class="equipment-slot-tab ${subTab === 'maintenance' ? 'active' : ''}" data-action="card-subtab" data-subtab="maintenance" data-boat-id="${escAttr(boatId)}">Maintenance (${maintLog.length})</button>
    </div>`;

    let tableHtml;
    if (subTab === 'spare') {
      tableHtml = renderItemsTable(boatId, spareItems, now, pending.length ? 'Imported rows are awaiting review above; no spares have been added to this boat yet.' : 'No spares logged yet — import a PDF/CSV, paste a listing, or add one manually above (set "Import as" to Spare).');
    } else if (subTab === 'maintenance') {
      tableHtml = renderMaintenanceTable(boatId, maintLog);
    } else {
      tableHtml = renderItemsTable(boatId, equipItems, now, pending.length ? 'Imported rows are awaiting review above; no equipment has been added to this boat yet.' : 'No equipment logged yet — import a PDF/CSV, paste a listing, or add an item manually above.');
    }

    const gapListHtml = finance.gapInfo.gaps.length
      ? `<details class="eq-gap-details">
          <summary>${finance.gapInfo.gaps.length} item${finance.gapInfo.gaps.length === 1 ? '' : 's'} needed to match the comparison spec (+${formatMoney(finance.gapInfo.upgradeCost)})</summary>
          <ul class="eq-gap-list">${finance.gapInfo.gaps.map(g => `<li><strong>${escAttr(g.category)}:</strong> ${g.reason === 'overdue' ? 'overdue, upgrade to' : 'missing'} ${escAttr(g.name)} (${formatMoney(g.cost)})</li>`).join('')}</ul>
        </details>`
      : (finance.referenceCount ? '<p class="eq-gap-none">Matches or exceeds the comparison spec in every logged category.</p>' : '');

    let charterHtml = '';
    if (charter.flagged) {
      const starStr = '★'.repeat(charter.stars) + '☆'.repeat(5 - charter.stars);
      const verdictGood = charter.priceIsGood && charter.maintenanceIsGood;
      const reasons = [];
      if (!charter.priceIsGood) reasons.push('the price isn\'t clearly a bargain yet (vs. Comparative Price)');
      if (!charter.maintenanceIsGood) reasons.push('the maintenance history isn\'t well enough documented yet');
      const verdictText = verdictGood
        ? 'Priced well below its Comparative Price with a solid, well-documented maintenance record — worth a closer look despite the charter-style fit-out.'
        : `Only worth considering if the price is excellent and maintenance is thoroughly documented — right now ${reasons.join(' and ')}.`;
      charterHtml = `
      <details class="eq-charter-badge ${verdictGood ? 'eq-charter-ok' : 'eq-charter-warn'}">
        <summary>⚠ Possible Charter Boat <span class="eq-charter-stars" title="Confidence (${charter.matches}/${charter.evaluated} indicators)">${starStr}</span></summary>
        <p class="eq-charter-verdict">${verdictText}</p>
        <ul class="eq-charter-criteria">${charter.criteria.map(c => `<li class="${c.match ? 'is-match' : ''}">${c.match ? '✓' : '·'} ${escAttr(c.label)}</li>`).join('')}</ul>
      </details>`;
    }

    return `
    <div class="equipment-boat-card boat${slot}">
      <div class="equipment-boat-card-header">
        <div>
          <h3>${escAttr(boat.manufacturer + ' ' + boat.name)}${nickname ? ` — <span class="eq-boat-nickname">"${escAttr(nickname)}"</span>` : ''}${isModel ? ' <span class="model-badge">★ MODEL BOAT</span>' : ''}</h3>
          <span class="equipment-item-count">${countText}</span>
          ${charterHtml}
        </div>
        <div class="equipment-header-actions">
          <button type="button" class="btn-icon" data-action="lookup-prices" data-boat-id="${escAttr(boatId)}" title="Apply bundled, dated public price references, not a live web search">Look up missing prices</button>
          <button type="button" class="btn-icon eq-model-btn ${isModel ? 'active' : ''}" data-action="toggle-model" data-boat-id="${escAttr(boatId)}">${isModel ? '✓ Model Boat' : 'Set as Model Boat'}</button>
          <button type="button" class="btn-icon" data-action="export-csv" data-boat-id="${escAttr(boatId)}" title="Download equipment & spares as CSV">⬇ CSV</button>
        </div>
      </div>
      ${subTabsHtml}
      ${pendingNotice}
      <details class="eq-rows-toggle" ${collapsed ? '' : 'open'}>
        <summary data-action="toggle-rows" data-boat-id="${escAttr(boatId)}" aria-controls="eq-rows-${escAttr(boatId)}">${subTab === 'spare' ? 'Spares' : subTab === 'maintenance' ? 'Maintenance' : 'Equipment'} rows</summary>
        <div id="eq-rows-${escAttr(boatId)}">${tableHtml}</div>
      </details>
      ${comparisonUnpriced ? `<p class="eq-price-warning">${unpriced} row(s) on this boat need a price (${comparisonUnpriced} across the comparison). USD valuations and Comparative Prices are provisional until all equipment/spares are priced.</p>` : ''}
      <div class="equipment-summary-box">
        <div class="equipment-summary-row"><span>As-New Value (equip. + spares, USD${unpriced ? ', partial' : ''})</span><strong>${formatMoney(finance.totalAsNew)}</strong></div>
        <div class="equipment-summary-row"><span>Accrued Depreciation</span><strong class="eq-neg">${finance.totalAccrued > 0 ? '-' : ''}${formatMoney(finance.totalAccrued)}</strong></div>
        <label class="equipment-asking-row">
          <span>Asking / List Price</span>
          <input type="number" min="0" step="1000" class="eq-input eq-asking-input" data-field="askingPrice" data-boat-id="${escAttr(boatId)}" value="${finance.askingPrice || 0}">
        </label>
        <label class="equipment-asking-row">
          <span>Boat Name (this actual boat)</span>
          <input type="text" class="eq-input eq-asking-input" data-field="nickname" data-boat-id="${escAttr(boatId)}" value="${escAttr(nickname)}" placeholder="e.g. Seaduction" title="This specific boat's own name - auto-detected from an imported folder name (e.g. &quot;FP Saona 47 Seaduction&quot;), or type it in">
        </label>
        <label class="equipment-asking-row">
          <span>Cabins (this actual boat)</span>
          <input type="number" min="0" step="1" class="eq-input eq-asking-input" data-field="cabins" data-boat-id="${escAttr(boatId)}" value="${charter.cabins || ''}" title="Actual cabin count of this specific boat - used for the Charter Boat indicator">
        </label>
        <div class="equipment-summary-row eq-subtle-row"><span>My Buy Price</span><span>${formatMoney(finance.myBuyPrice)}</span></div>
        ${finance.referenceCount ? `<div class="equipment-summary-row eq-subtle-row"><span>Cost to Match Comparison</span><span>+${formatMoney(finance.gapInfo.upgradeCost)}</span></div>` : ''}
        ${gapListHtml}
        <div class="equipment-summary-row equipment-comparative-row"><span>Comparative Price</span><strong>${formatMoney(finance.comparativePrice)}</strong></div>
      </div>
    </div>`;
  }

  // Shows the actual selected boat's name on each "Boat 1/2/3" target tab (e.g. "Elba 45"
  // rather than a generic slot number) so it's clear which real boat new/imported rows go to.
  function updateSlotTabLabels() {
    if (!elements.slotTabs) return;
    [1, 2, 3].forEach(slot => {
      const btn = elements.slotTabs.querySelector(`[data-slot="${slot}"]`);
      if (!btn) return;
      const boat = getSlotBoat(slot);
      btn.textContent = boat ? boat.name : `Boat ${slot}`;
      btn.title = boat ? `Boat ${slot} — ${boat.manufacturer} ${boat.name}` : '';
    });
  }

  function renderAll() {
    if (!elements.boatsGrid) return;
    syncImportTarget();
    renderStaging();
    updateSlotTabLabels();
    const slotsWithBoats = [1, 2, 3].map(slot => ({ slot, boat: getSlotBoat(slot) })).filter(x => x.boat);
    // Precompute every compared boat's Comparative Price once so the Charter Boat "price is good"
    // check can judge a boat against the others in the comparison, not against its own figure.
    const peerComparativePrices = slotsWithBoats.map(({ boat }) => ({
      boatId: boat.id, comparativePrice: computeBoatFinancials(boat.id, boat).comparativePrice
    }));
    const cards = slotsWithBoats.map(({ slot, boat }) => renderBoatCard(slot, boat, peerComparativePrices));

    elements.boatsGrid.innerHTML = cards.length
      ? cards.join('')
      : `<p class="eq-empty-note">Select at least one boat above (Boat Model 1/2/3) to start logging its equipment.</p>`;

    renderReferenceSection();
  }

  // ---------------------------------------------------------------------
  // Event delegation handlers
  // ---------------------------------------------------------------------
  function onBoatsGridChange(e) {
    const t = e.target;
    if (!t.matches('[data-field]')) return;
    const field = t.dataset.field;

    if (t.dataset.maintId !== undefined) {
      const boatId = t.dataset.maintBoatId;
      const entry = getMaintenanceForBoat(boatId).find(x => x.id === t.dataset.maintId);
      if (!entry) return;
      entry[field] = field === 'cost' ? (parseFloat(t.value) || 0) : t.value;
      saveMaintenanceLog();
      renderAll();
      return;
    }

    const boatId = t.dataset.boatId;
    if (field === 'askingPrice') {
      equipmentState.askingPrices[boatId] = parseFloat(t.value) || 0;
      saveAskingPrices();
      renderAll();
      return;
    }
    if (field === 'cabins') {
      equipmentState.cabins[boatId] = parseInt(t.value, 10) || 0;
      saveCabins();
      renderAll();
      return;
    }
    if (field === 'nickname') {
      equipmentState.nicknames[boatId] = t.value.trim();
      saveNicknames();
      renderAll();
      return;
    }

    const itemId = t.dataset.itemId;
    const item = getEquipmentForBoat(boatId).find(i => i.id === itemId);
    if (!item) return;
    if (field.startsWith('quote')) {
      item[field] = t.value;
      saveData();
      return;
    }
    if (field === 'rrp' || field === 'installCost' || field === 'lifeYears' || field === 'hours' || field === 'lifeHours') item[field] = parseFloat(t.value) || 0;
    else item[field] = t.value;
    if (field === 'rrp') item.priceInfo = { status: 'manual' };
    if (field === 'name' && item.priceInfo?.status === 'estimate') {
      item.rrp = 0; delete item.priceInfo; enrichPrice(item);
    }
    saveData();
    renderAll();
  }

  async function onBoatsGridClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const boatId = btn.dataset.boatId;

    if (action === 'review-import') {
      equipmentState.activeSlot = Number(btn.dataset.slot);
      elements.slotTabs.querySelectorAll('[data-slot]').forEach(tab => tab.classList.toggle('active', Number(tab.dataset.slot) === equipmentState.activeSlot));
      syncImportTarget();
      equipmentState.stagingCollapsed = false;
      renderStaging();
      elements.stagingWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (action === 'apply-quote') {
      const item = getEquipmentForBoat(boatId).find(i => i.id === btn.dataset.itemId);
      if (item && applyQuote(item)) { saveData(); renderAll(); }
    } else if (action === 'toggle-rows') {
      e.preventDefault(); // we manage open/closed state ourselves and re-render, rather than relying on native <details> toggling
      const key = `${boatId}:${equipmentState.cardSubTab[boatId] || 'equipment'}`;
      const wasCollapsed = key in equipmentState.collapsedTables ? !!equipmentState.collapsedTables[key] : true;
      equipmentState.collapsedTables[key] = !wasCollapsed;
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify(equipmentState.collapsedTables));
      renderAll();
    } else if (action === 'lookup-prices') {
      await priceDatabaseReady;
      getEquipmentForBoat(boatId).forEach(enrichPrice);
      saveData();
      renderAll();
      showToastLocal('Applied available researched prices. Open Research results on unpriced rows for component prices, specification checks or quote requirements.');
    } else if (action === 'card-subtab') {
      equipmentState.cardSubTab[boatId] = btn.dataset.subtab;
      renderAll();
    } else if (action === 'delete-maintenance') {
      equipmentState.maintenanceLog[boatId] = getMaintenanceForBoat(boatId).filter(x => x.id !== btn.dataset.maintId);
      saveMaintenanceLog();
      renderAll();
    } else if (action === 'toggle-ideal') {
      const item = getEquipmentForBoat(boatId).find(i => i.id === btn.dataset.itemId);
      if (item) { item.ideal = !item.ideal; saveData(); renderAll(); }
    } else if (action === 'delete-item') {
      equipmentState.data[boatId] = getEquipmentForBoat(boatId).filter(i => i.id !== btn.dataset.itemId);
      saveData();
      renderAll();
    } else if (action === 'toggle-model') {
      equipmentState.modelBoatId = equipmentState.modelBoatId === boatId ? null : boatId;
      saveModelBoat();
      renderAll();
    } else if (action === 'export-csv') {
      const boat = getBoatById(boatId);
      if (!boat) return;
      const items = getEquipmentForBoat(boatId);
      const header = ['Kind', 'Name', 'Category', 'RRP', 'Currency', 'Install Cost', 'Install Date', 'Life Expectancy (yrs)', 'Hours', 'Life Expectancy Hours', 'Notes', 'Source', 'Price Reference'];
      const lines = [header.join(',')];
      items.forEach(i => {
        lines.push([i.kind || 'equipment', i.name, i.category, i.rrp, 'USD', i.installCost, i.installDate, i.lifeYears, i.hours ?? '', i.lifeHours || '', i.notes || '', i.sourceNote || '', JSON.stringify(i.priceInfo || null)].map(csvEscape).join(','));
      });
      downloadBlob(`${(boat.manufacturer + '-' + boat.name).replace(/\s+/g, '-')}-equipment.csv`, lines.join('\n'), 'text/csv');
    }
  }

  function exportBackup() {
    const payload = {
      equipment: equipmentState.data,
      askingPrices: equipmentState.askingPrices,
      modelBoatId: equipmentState.modelBoatId,
      maintenanceLog: equipmentState.maintenanceLog,
      nicknames: equipmentState.nicknames,
      cabins: equipmentState.cabins,
      exportedAt: new Date().toISOString()
    };
    downloadBlob('catamaran-equipment-backup.json', JSON.stringify(payload, null, 2), 'application/json');
  }

  async function handleRestoreBackup(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (payload.equipment) equipmentState.data = payload.equipment;
      if (payload.askingPrices) equipmentState.askingPrices = payload.askingPrices;
      if (payload.modelBoatId !== undefined) equipmentState.modelBoatId = payload.modelBoatId;
      if (payload.maintenanceLog) equipmentState.maintenanceLog = payload.maintenanceLog;
      if (payload.nicknames) equipmentState.nicknames = payload.nicknames;
      if (payload.cabins) equipmentState.cabins = payload.cabins;
      saveData(); saveAskingPrices(); saveModelBoat(); saveMaintenanceLog();
      saveNicknames(); saveCabins();
      renderAll();
      showToastLocal('Equipment backup restored.');
    } catch (err) {
      showToastLocal('Could not read that backup file.');
    } finally {
      e.target.value = '';
    }
  }

  // ---------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------
  function renderPriceCatalogue() {
    const target = document.getElementById('equipmentPriceCatalogue');
    if (!target) return;
    const query = (document.getElementById('equipmentPriceSearch').value || '').trim().toLowerCase();
    const refs = pricing.references.filter(ref => `${ref.model} ${ref.category || ''}`.toLowerCase().includes(query));
    target.innerHTML = `<p>${refs.length} of ${pricing.references.length} priced products. Per-unit USD replacement references, not historical purchase costs. Verify configuration and availability.</p>
      <div class="equipment-table-container"><table class="equipment-table">
      <thead><tr><th>Equipment</th><th>Category</th><th>Unit USD</th><th>Source / configuration</th><th>PDF / cruiser evidence</th></tr></thead>
      <tbody>${refs.map(ref => `<tr><td>${escAttr(ref.model)}${ref.reviewOnly ? ' (review required)' : ''}</td>
        <td>${escAttr(ref.category || '')}</td><td>${(ref.usd ?? pricing.toUSD(ref.amount, ref.currency)).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</td>
        <td>${renderPriceInfo({ rrp: ref.usd ?? pricing.toUSD(ref.amount, ref.currency), priceInfo: {
          ...ref, status: 'estimate', quantity: 1, checkedDate: ref.checkedDate || pricing.checkedDate,
          fxDate: ref.fxDate || pricing.fx.date, fxRate: ref.fxRate ?? 1 / pricing.fx.perUSD[ref.currency],
          fxSource: ref.fxSource || pricing.fx.source
        } })}</td>
        <td>${(ref.evidence || []).map(source => `<p>${escAttr(source.boat_model || 'Supplemental research')}: ${escAttr(source.kind)} -
          ${source.source_url && /^https?:\/\//i.test(source.source_url) ? `<a href="${escAttr(source.source_url)}" target="_blank" rel="noopener noreferrer">${escAttr(source.title)}</a>` : escAttr(source.title)}
          <br>${escAttr(source.notes)}</p>`).join('') || 'Bundled reference; database evidence unavailable.'}</td></tr>`).join('')}</tbody></table></div>`;
  }

  async function loadPriceDatabase() {
    const status = document.getElementById('equipmentPriceDatabaseStatus');
    try {
      const response = await fetch('/api/equipment-prices', { cache: 'no-store' });
      if (!(response.headers.get('content-type') || '').includes('application/json')) {
        throw new Error('The local server does not support the price database.');
      }
      const catalogue = await response.json();
      if (!response.ok) throw new Error(catalogue.error || 'Price database request failed.');
      pricing.useCatalogue(catalogue);
      status.textContent = `SQLite price database connected: ${pricing.references.length} products in USD; ${catalogue.researchRequirements.length} research requirements. Existing entered prices are not changed.`;
    } catch (err) {
      console.error('Equipment price database unavailable.', err);
      status.textContent = `Price database unavailable: ${err.message} Using ${pricing.references.length} bundled references instead. Start the photo/price-enabled local_server.py.`;
    }
    renderPriceCatalogue();
    renderAll();
  }

  function init() {
    elements.boatsGrid = document.getElementById('equipmentBoatsGrid');
    if (!elements.boatsGrid) return; // Equipment tab not present on this page

    elements.idealContent = document.getElementById('equipmentIdealContent');
    elements.slotTabs = document.getElementById('equipmentSlotTabs');
    elements.kindTabs = document.getElementById('equipmentKindTabs');
    elements.fileInput = document.getElementById('equipmentFileInput');
    elements.folderInput = document.getElementById('equipmentFolderInput');
    elements.pasteArea = document.getElementById('equipmentPasteArea');
    elements.parsePasteBtn = document.getElementById('equipmentParsePasteBtn');
    elements.addManualBtn = document.getElementById('equipmentAddManualBtn');
    elements.exportBackupBtn = document.getElementById('equipmentExportBackupBtn');
    elements.restoreInput = document.getElementById('equipmentRestoreInput');
    elements.stagingWrap = document.getElementById('equipmentStagingWrap');
    elements.stagingCount = document.getElementById('equipmentStagingCount');
    elements.stagingTable = document.getElementById('equipmentStagingTable');
    elements.commitBtn = document.getElementById('equipmentCommitBtn');
    elements.discardBtn = document.getElementById('equipmentDiscardBtn');
    elements.stagingToggleBtn = document.getElementById('equipmentStagingToggleBtn');
    elements.importStatus = document.getElementById('equipmentImportStatus');
    priceDatabaseReady = loadPriceDatabase();
    document.getElementById('equipmentPriceSearch').addEventListener('input', renderPriceCatalogue);
    document.getElementById('equipmentSelectAllBtn').addEventListener('click', () => {
      equipmentState.pendingImport.forEach(row => { row._checked = true; });
      renderStaging();
    });
    document.getElementById('equipmentSelectNoneBtn').addEventListener('click', () => {
      equipmentState.pendingImport.forEach(row => { row._checked = false; });
      renderStaging();
    });
    document.getElementById('equipmentPriceStagedBtn').addEventListener('click', async () => {
      await priceDatabaseReady;
      const before = equipmentState.pendingImport.filter(row => row.rrp > 0).length;
      equipmentState.pendingImport.forEach(enrichPrice);
      renderStaging();
      const added = equipmentState.pendingImport.filter(row => row.rrp > 0).length - before;
      showToastLocal(`Added ${added} sourced price estimate(s). Review prices before adding rows to the boat.`);
    });

    elements.slotTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.equipment-slot-tab');
      if (!btn) return;
      elements.slotTabs.querySelectorAll('.equipment-slot-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      equipmentState.activeSlot = parseInt(btn.dataset.slot, 10);
      syncImportTarget();
      renderStaging();
    });

    if (elements.kindTabs) {
      elements.kindTabs.addEventListener('click', (e) => {
        const btn = e.target.closest('.equipment-slot-tab');
        if (!btn) return;
        elements.kindTabs.querySelectorAll('.equipment-slot-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        equipmentState.activeKind = btn.dataset.kind;
      });
    }

    elements.fileInput.addEventListener('change', handleFileInput);
    elements.folderInput.addEventListener('change', handleFileInput);
    elements.parsePasteBtn.addEventListener('click', async () => {
      await priceDatabaseReady;
      const rows = parsePastedContent(elements.pasteArea.value);
      if (!rows.length) { showToastLocal('No rows found in that text.'); return; }
      stageRows(rows);
    });
    elements.addManualBtn.addEventListener('click', addManualItem);
    elements.exportBackupBtn.addEventListener('click', exportBackup);
    elements.restoreInput.addEventListener('change', handleRestoreBackup);
    elements.commitBtn.addEventListener('click', commitStaged);
    elements.discardBtn.addEventListener('click', discardStaged);
    elements.stagingToggleBtn.addEventListener('click', () => {
      equipmentState.stagingCollapsed = !equipmentState.stagingCollapsed;
      applyStagingCollapsedState();
    });
    elements.stagingTable.addEventListener('change', onStagingChange);
    elements.stagingTable.addEventListener('click', e => {
      const btn = e.target.closest('[data-action="apply-quote"]');
      if (!btn) return;
      const row = equipmentState.pendingImport[Number(btn.dataset.rowIdx)];
      if (row && applyQuote(row)) renderStaging();
    });

    elements.boatsGrid.addEventListener('click', onBoatsGridClick);
    elements.boatsGrid.addEventListener('change', onBoatsGridChange);

    ['boatSelect1', 'boatSelect2', 'boatSelect3', 'vppBoatSelect1', 'vppBoatSelect2', 'vppBoatSelect3'].forEach(id => {
      const sel = document.getElementById(id);
      if (sel) sel.addEventListener('change', renderAll);
    });

    document.querySelectorAll('.tab-nav-btn[data-tab="tabEquipment"]').forEach(btn => {
      btn.addEventListener('click', renderAll);
    });

    renderAll();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
