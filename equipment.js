/**
 * Equipment Inventory, Depreciation & "My Buy Price" Module
 *
 * Lets the user catalogue every piece of equipment fitted to each of the 3 compared boats
 * (parsed from an uploaded PDF/CSV, pasted webpage text, or typed in manually), tracks each
 * item's RRP, install cost, install date and life expectancy, and derives:
 *  - Replacement due dates and an age/condition status (OK / Due Soon / Overdue)
 *  - A depreciation-adjusted "My Buy Price" (asking price minus accrued equipment depreciation)
 *  - An "Ideal / Model Boat" spec, built from a nominated best-equipped boat and/or starred items,
 *    with a gap analysis of what each candidate boat would need to match it.
 *
 * All data is stored client-side only (localStorage) - nothing is uploaded anywhere.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'cc_equipment_data_v1';
  const ASKING_PRICE_KEY = 'cc_equipment_asking_prices_v1';
  const MODEL_BOAT_KEY = 'cc_equipment_model_boat_v1';
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

  const equipmentState = {
    data: loadJson(STORAGE_KEY, {}),           // { [boatId]: EquipmentItem[] }
    askingPrices: loadJson(ASKING_PRICE_KEY, {}), // { [boatId]: number }
    modelBoatId: loadJson(MODEL_BOAT_KEY, null),  // boatId nominated as the "best equipped" model
    pendingImport: [],                          // staged rows awaiting review/commit
    activeSlot: 1                               // which boat slot (1/2/3) new/imported items go to
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
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return '';
  }

  function formatMoney(n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    const sign = n < 0 ? '-' : '';
    return sign + '$' + Math.round(Math.abs(n)).toLocaleString();
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

    let ageYears = null, remainingYears = null, depreciationFraction = 0, currentValue = totalCost,
      status = 'unknown', dueDate = null;

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

    const accruedDepreciation = totalCost - currentValue;
    return { totalCost, ageYears, remainingYears, depreciationFraction, currentValue, accruedDepreciation, status, dueDate };
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

  function mapRowToEquipment(obj, source) {
    const norm = {};
    Object.keys(obj).forEach(k => { norm[normalizeKey(k)] = obj[k]; });
    const pick = (...keys) => {
      for (const k of keys) {
        const v = norm[normalizeKey(k)];
        if (v !== undefined && String(v).trim() !== '') return v;
      }
      return '';
    };
    const name = pick('name', 'item', 'equipment', 'description', 'product', 'title') || 'Unnamed item';
    const category = pick('category', 'type', 'group') || guessCategory(name);
    const rrp = parseMoney(pick('rrp', 'price', 'msrp', 'retailprice', 'listprice', 'cost', 'unitprice'));
    const installCost = parseMoney(pick('installcost', 'install', 'labour', 'labor', 'fittingcost', 'laborcost'));
    const installDate = parseDateFlexible(pick('installdate', 'dateinstalled', 'date', 'purchased', 'purchasedate', 'fitted'));
    const lifeRaw = pick('lifeyears', 'lifeexpectancy', 'lifeexpectancyyears', 'expectedlife', 'lifespan', 'usefullife');
    const lifeYears = lifeRaw !== '' ? (parseFloat(lifeRaw) || defaultLifeForCategory(category)) : defaultLifeForCategory(category);
    const notes = pick('notes', 'comment', 'comments', 'remarks');
    return { id: uid(), name, category, rrp, installCost, installDate, lifeYears, notes, ideal: false, source: source || 'import' };
  }

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length);
    if (!lines.length) return [];
    const headers = splitCsvLine(lines[0]).map(h => h.toLowerCase());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCsvLine(lines[i]);
      if (cols.every(c => !c)) continue;
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = cols[idx] !== undefined ? cols[idx] : ''; });
      rows.push(mapRowToEquipment(obj, 'csv'));
    }
    return rows;
  }

  // Fallback heuristic parser for free-form text (PDF text / plain pasted text):
  // finds lines containing a currency amount and treats the text before it as the item name.
  function parseFreeText(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const rows = [];
    const amountRe = /\$\s?[\d,]+(?:\.\d{1,2})?/g;
    lines.forEach(line => {
      if (/^(page \d+|subtotal|^total$|gst|tax invoice)\b/i.test(line) && !/\$/.test(line)) return;
      const amounts = line.match(amountRe);
      if (!amounts || !amounts.length) return;
      const firstIdx = line.indexOf(amounts[0]);
      let name = line.slice(0, firstIdx).replace(/[-:|\t]+$/, '').trim();
      if (!name) name = line.replace(amounts[0], '').trim().slice(0, 60);
      if (!name) name = 'Unnamed item';
      const category = guessCategory(name);
      rows.push({
        id: uid(), name, category,
        rrp: parseMoney(amounts[0]),
        installCost: amounts.length > 1 ? parseMoney(amounts[1]) : 0,
        installDate: '', lifeYears: defaultLifeForCategory(category), notes: '', ideal: false, source: 'parsed'
      });
    });
    return rows;
  }

  function parsePastedContent(raw) {
    if (!raw || !raw.trim()) return [];

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
              rows.push(mapRowToEquipment(obj, 'webpage'));
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
        const looksLikeHeader = headers.some(h => /name|item|rrp|price|cost|category/i.test(h));
        const rows = [];
        const startIdx = looksLikeHeader ? 1 : 0;
        for (let i = startIdx; i < lines.length; i++) {
          if (looksLikeHeader) {
            const cells = lines[i].split('\t').map(c => c.trim());
            const obj = {};
            headers.forEach((h, idx) => { obj[h] = cells[idx] || ''; });
            rows.push(mapRowToEquipment(obj, 'webpage'));
          } else {
            rows.push(...parseFreeText(lines[i]));
          }
        }
        if (rows.length) return rows;
      }
    }

    return parseFreeText(raw);
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

  async function parsePdfFile(file) {
    const pdfjsLib = await ensurePdfJs();
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    let fullText = '';
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const lineMap = new Map();
      content.items.forEach(it => {
        const y = Math.round(it.transform[5]);
        if (!lineMap.has(y)) lineMap.set(y, []);
        lineMap.get(y).push(it.str);
      });
      const lines = Array.from(lineMap.entries()).sort((a, b) => b[0] - a[0]).map(([, parts]) => parts.join(' '));
      fullText += lines.join('\n') + '\n';
    }
    return parseFreeText(fullText);
  }

  async function handleFileInput(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      let rows = [];
      if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
        showToastLocal('Parsing PDF…');
        rows = await parsePdfFile(file);
      } else {
        const text = await file.text();
        rows = parseCSV(text);
      }
      if (!rows.length) { showToastLocal('No equipment rows found in that file. Try manual entry instead.'); return; }
      stageRows(rows);
    } catch (err) {
      showToastLocal('Could not parse that file: ' + (err && err.message ? err.message : 'unknown error'));
    } finally {
      e.target.value = '';
    }
  }

  // ---------------------------------------------------------------------
  // Staging (review-before-commit) table
  // ---------------------------------------------------------------------
  function stageRows(rows) {
    equipmentState.pendingImport = rows.map(r => ({ ...r, _checked: true }));
    renderStaging();
  }

  function renderStaging() {
    const rows = equipmentState.pendingImport;
    elements.stagingWrap.classList.toggle('is-hidden', rows.length === 0);
    if (!rows.length) { elements.stagingTable.innerHTML = ''; return; }
    elements.stagingCount.textContent = `${rows.length} parsed row${rows.length === 1 ? '' : 's'} — review, then add to Boat ${equipmentState.activeSlot}`;
    elements.stagingTable.innerHTML = `
      <thead><tr>
        <th><input type="checkbox" id="equipmentStagingAllToggle" checked></th>
        <th>Item</th><th>Category</th><th>RRP</th><th>Install</th><th>Installed</th><th>Life (yrs)</th>
      </tr></thead>
      <tbody>${rows.map((r, idx) => `
        <tr>
          <td><input type="checkbox" data-field="_checked" data-row-idx="${idx}" ${r._checked ? 'checked' : ''}></td>
          <td><input type="text" class="eq-input eq-input-name" data-field="name" data-row-idx="${idx}" value="${escAttr(r.name)}"></td>
          <td><select class="eq-input" data-field="category" data-row-idx="${idx}">${CATEGORY_OPTIONS.map(c => `<option value="${escAttr(c)}" ${c === r.category ? 'selected' : ''}>${escAttr(c)}</option>`).join('')}</select></td>
          <td><input type="number" min="0" step="1" class="eq-input eq-input-num" data-field="rrp" data-row-idx="${idx}" value="${r.rrp || 0}"></td>
          <td><input type="number" min="0" step="1" class="eq-input eq-input-num" data-field="installCost" data-row-idx="${idx}" value="${r.installCost || 0}"></td>
          <td><input type="date" class="eq-input" data-field="installDate" data-row-idx="${idx}" value="${r.installDate || ''}"></td>
          <td><input type="number" min="0" step="0.5" class="eq-input eq-input-num" data-field="lifeYears" data-row-idx="${idx}" value="${r.lifeYears || 0}"></td>
        </tr>`).join('')}</tbody>`;
    const allToggle = document.getElementById('equipmentStagingAllToggle');
    if (allToggle) {
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
    else if (field === 'rrp' || field === 'installCost' || field === 'lifeYears') row[field] = parseFloat(t.value) || 0;
    else row[field] = t.value;
  }

  function commitStaged() {
    const slot = equipmentState.activeSlot;
    const boat = getSlotBoat(slot);
    if (!boat) { showToastLocal(`Select a boat in Boat ${slot} above first.`); return; }
    const checked = equipmentState.pendingImport.filter(r => r._checked);
    if (!checked.length) { showToastLocal('No rows are checked to add.'); return; }
    if (!equipmentState.data[boat.id]) equipmentState.data[boat.id] = [];
    checked.forEach(r => {
      const item = { ...r };
      delete item._checked;
      equipmentState.data[boat.id].push(item);
    });
    saveData();
    equipmentState.pendingImport = [];
    renderStaging();
    renderAll();
    showToastLocal(`Added ${checked.length} item(s) to ${boat.manufacturer} ${boat.name}.`);
  }

  function discardStaged() {
    equipmentState.pendingImport = [];
    renderStaging();
  }

  function addManualItem() {
    const slot = equipmentState.activeSlot;
    const boat = getSlotBoat(slot);
    if (!boat) { showToastLocal(`Select a boat in Boat ${slot} above first.`); return; }
    if (!equipmentState.data[boat.id]) equipmentState.data[boat.id] = [];
    equipmentState.data[boat.id].push({
      id: uid(), name: 'New item', category: 'Other', rrp: 0, installCost: 0, installDate: '',
      lifeYears: defaultLifeForCategory('Other'), notes: '', ideal: false, source: 'manual'
    });
    saveData();
    renderAll();
  }

  // ---------------------------------------------------------------------
  // Ideal / Model Boat builder
  // ---------------------------------------------------------------------
  function buildIdealList() {
    const starredByCategory = {};
    const starred = [];
    Object.keys(equipmentState.data).forEach(bid => {
      getEquipmentForBoat(bid).forEach(item => {
        if (item.ideal) {
          const entry = { ...item, boatId: bid };
          starred.push(entry);
          (starredByCategory[item.category] = starredByCategory[item.category] || []).push(entry);
        }
      });
    });

    let modelItems = [];
    if (equipmentState.modelBoatId && equipmentState.data[equipmentState.modelBoatId]) {
      modelItems = getEquipmentForBoat(equipmentState.modelBoatId)
        .filter(item => !starredByCategory[item.category])
        .map(item => ({ ...item, boatId: equipmentState.modelBoatId }));
    }
    return [...modelItems, ...starred];
  }

  function computeIdealGap(boatId, idealList) {
    const items = getEquipmentForBoat(boatId);
    let matched = 0;
    const gaps = [];
    let upgradeCost = 0;
    idealList.forEach(idealItem => {
      const idealTotal = (Number(idealItem.rrp) || 0) + (Number(idealItem.installCost) || 0);
      if (idealItem.boatId === boatId) { matched++; return; }
      const candidates = items.filter(i => i.category === idealItem.category)
        .sort((a, b) => ((b.rrp || 0) + (b.installCost || 0)) - ((a.rrp || 0) + (a.installCost || 0)));
      const candidateTotal = candidates.length ? (Number(candidates[0].rrp) || 0) + (Number(candidates[0].installCost) || 0) : 0;
      if (candidateTotal >= idealTotal * 0.98) {
        matched++;
      } else {
        const cost = Math.max(0, idealTotal - candidateTotal);
        upgradeCost += cost;
        gaps.push({ category: idealItem.category, name: idealItem.name, cost });
      }
    });
    return { matched, gaps, upgradeCost };
  }

  function renderIdealSection() {
    const idealList = buildIdealList();
    const idealTotal = idealList.reduce((s, i) => s + (Number(i.rrp) || 0) + (Number(i.installCost) || 0), 0);
    const modelBoat = equipmentState.modelBoatId ? getBoatById(equipmentState.modelBoatId) : null;

    if (!idealList.length) {
      elements.idealContent.innerHTML = `<p class="eq-empty-note">Star (★) equipment items in the tables above, or click "Set as Model Boat" on your best-equipped candidate, to build an ideal spec here.</p>`;
      return;
    }

    let html = `<div class="equipment-ideal-summary">
      <span>${modelBoat ? 'Model boat: <strong>' + escAttr(modelBoat.manufacturer + ' ' + modelBoat.name) + '</strong>' : 'Custom star-built spec'}</span>
      <span>Ideal Build Total (RRP + install): <strong>${formatMoney(idealTotal)}</strong></span>
    </div>`;

    html += `<div class="equipment-table-container"><table class="equipment-table eq-ideal-table">
      <thead><tr><th>Item</th><th>Category</th><th>Sourced From</th><th>RRP</th><th>Install</th><th>Total</th></tr></thead>
      <tbody>${idealList.map(i => {
      const sourceBoat = getBoatById(i.boatId);
      const total = (Number(i.rrp) || 0) + (Number(i.installCost) || 0);
      return `<tr><td>${escAttr(i.name)}</td><td>${escAttr(i.category)}</td><td>${sourceBoat ? escAttr(sourceBoat.manufacturer + ' ' + sourceBoat.name) : '—'}</td><td>${formatMoney(i.rrp)}</td><td>${formatMoney(i.installCost)}</td><td>${formatMoney(total)}</td></tr>`;
    }).join('')}</tbody>
    </table></div>`;

    const slotsWithBoats = [1, 2, 3].map(s => ({ slot: s, boat: getSlotBoat(s) })).filter(x => x.boat);
    if (slotsWithBoats.length) {
      html += `<div class="equipment-ideal-gaps-grid">`;
      slotsWithBoats.forEach(({ slot, boat }) => {
        const gapInfo = computeIdealGap(boat.id, idealList);
        html += `<div class="equipment-gap-card boat${slot}">
          <h4>${escAttr(boat.manufacturer + ' ' + boat.name)}</h4>
          <div class="eq-gap-score">${gapInfo.matched}/${idealList.length} ideal items matched or exceeded</div>
          <div class="eq-gap-cost">Upgrade cost to reach ideal spec: <strong>${formatMoney(gapInfo.upgradeCost)}</strong></div>
          ${gapInfo.gaps.length
            ? `<ul class="eq-gap-list">${gapInfo.gaps.map(g => `<li><strong>${escAttr(g.category)}:</strong> needs ${escAttr(g.name)} (${formatMoney(g.cost)})</li>`).join('')}</ul>`
            : '<p class="eq-gap-none">Matches the ideal spec in every logged category.</p>'}
        </div>`;
      });
      html += `</div>`;
    }

    elements.idealContent.innerHTML = html;
  }

  // ---------------------------------------------------------------------
  // Per-boat equipment table + summary rendering
  // ---------------------------------------------------------------------
  function renderItemRow(boatId, item, metrics) {
    const statusLabel = { ok: 'OK', 'due-soon': 'Due soon', overdue: 'Overdue', unknown: '—' }[metrics.status];
    const ageStr = metrics.ageYears != null ? metrics.ageYears.toFixed(1) + ' yr' : '—';
    const dueStr = metrics.dueDate ? 'due ' + metrics.dueDate.toLocaleDateString() : '';
    return `
    <tr>
      <td class="eq-star-cell"><button type="button" class="eq-star-btn ${item.ideal ? 'active' : ''}" data-action="toggle-ideal" data-boat-id="${escAttr(boatId)}" data-item-id="${escAttr(item.id)}" title="Mark as ideal/model equipment">★</button></td>
      <td><input type="text" class="eq-input eq-input-name" data-field="name" data-boat-id="${escAttr(boatId)}" data-item-id="${escAttr(item.id)}" value="${escAttr(item.name)}"></td>
      <td><select class="eq-input" data-field="category" data-boat-id="${escAttr(boatId)}" data-item-id="${escAttr(item.id)}">
        ${CATEGORY_OPTIONS.map(c => `<option value="${escAttr(c)}" ${c === item.category ? 'selected' : ''}>${escAttr(c)}</option>`).join('')}
      </select></td>
      <td><input type="number" min="0" step="1" class="eq-input eq-input-num" data-field="rrp" data-boat-id="${escAttr(boatId)}" data-item-id="${escAttr(item.id)}" value="${item.rrp || 0}"></td>
      <td><input type="number" min="0" step="1" class="eq-input eq-input-num" data-field="installCost" data-boat-id="${escAttr(boatId)}" data-item-id="${escAttr(item.id)}" value="${item.installCost || 0}"></td>
      <td><input type="date" class="eq-input" data-field="installDate" data-boat-id="${escAttr(boatId)}" data-item-id="${escAttr(item.id)}" value="${item.installDate || ''}"></td>
      <td><input type="number" min="0" step="0.5" class="eq-input eq-input-num" data-field="lifeYears" data-boat-id="${escAttr(boatId)}" data-item-id="${escAttr(item.id)}" value="${item.lifeYears || 0}"></td>
      <td class="eq-readonly">${ageStr}</td>
      <td><span class="eq-status-badge status-${metrics.status}">${statusLabel}</span>${dueStr ? `<div class="eq-due-date">${dueStr}</div>` : ''}</td>
      <td class="eq-readonly eq-mono">${formatMoney(metrics.currentValue)}</td>
      <td><button type="button" class="eq-del-btn" data-action="delete-item" data-boat-id="${escAttr(boatId)}" data-item-id="${escAttr(item.id)}" title="Remove item">✕</button></td>
    </tr>`;
  }

  function renderBoatCard(slot, boat) {
    const boatId = boat.id;
    const items = getEquipmentForBoat(boatId);
    const now = new Date();
    const rows = items.map(item => ({ item, metrics: computeItemMetrics(item, now) }));
    const totalAsNew = rows.reduce((s, r) => s + r.metrics.totalCost, 0);
    const totalAccrued = rows.reduce((s, r) => s + r.metrics.accruedDepreciation, 0);
    const overdue = rows.filter(r => r.metrics.status === 'overdue').length;
    const dueSoon = rows.filter(r => r.metrics.status === 'due-soon').length;
    const askingPrice = getAskingPrice(boatId, boat);
    const myBuyPrice = Math.max(0, askingPrice - totalAccrued);
    const isModel = equipmentState.modelBoatId === boatId;

    let countText = `${items.length} item${items.length === 1 ? '' : 's'}`;
    if (overdue) countText += ` · ${overdue} overdue`;
    if (dueSoon) countText += ` · ${dueSoon} due soon`;

    return `
    <div class="equipment-boat-card boat${slot}">
      <div class="equipment-boat-card-header">
        <div>
          <h3>${escAttr(boat.manufacturer + ' ' + boat.name)}${isModel ? ' <span class="model-badge">★ MODEL BOAT</span>' : ''}</h3>
          <span class="equipment-item-count">${countText}</span>
        </div>
        <div class="equipment-header-actions">
          <button type="button" class="btn-icon eq-model-btn ${isModel ? 'active' : ''}" data-action="toggle-model" data-boat-id="${escAttr(boatId)}">${isModel ? '✓ Model Boat' : 'Set as Model Boat'}</button>
          <button type="button" class="btn-icon" data-action="export-csv" data-boat-id="${escAttr(boatId)}" title="Download this equipment list as CSV">⬇ CSV</button>
        </div>
      </div>
      <div class="equipment-table-container">
        <table class="equipment-table">
          <thead><tr><th>★</th><th>Item</th><th>Category</th><th>RRP</th><th>Install</th><th>Installed</th><th>Life (yrs)</th><th>Age</th><th>Status</th><th>Value Today</th><th></th></tr></thead>
          <tbody>${rows.length
        ? rows.map(r => renderItemRow(boatId, r.item, r.metrics)).join('')
        : `<tr><td colspan="11" class="eq-empty-row">No equipment logged yet — import a PDF/CSV, paste a listing, or add an item manually above.</td></tr>`}</tbody>
        </table>
      </div>
      <div class="equipment-summary-box">
        <div class="equipment-summary-row"><span>As-New Equipped Value (RRP + install)</span><strong>${formatMoney(totalAsNew)}</strong></div>
        <div class="equipment-summary-row"><span>Accrued Equipment Depreciation</span><strong class="eq-neg">${totalAccrued > 0 ? '-' : ''}${formatMoney(totalAccrued)}</strong></div>
        <label class="equipment-asking-row">
          <span>Asking / List Price</span>
          <input type="number" min="0" step="1000" class="eq-input eq-asking-input" data-field="askingPrice" data-boat-id="${escAttr(boatId)}" value="${askingPrice || 0}">
        </label>
        <div class="equipment-summary-row equipment-buyprice-row"><span>My Buy Price</span><strong>${formatMoney(myBuyPrice)}</strong></div>
      </div>
    </div>`;
  }

  function renderAll() {
    if (!elements.boatsGrid) return;
    const cards = [1, 2, 3].map(slot => {
      const boat = getSlotBoat(slot);
      return boat ? renderBoatCard(slot, boat) : '';
    }).filter(Boolean);

    elements.boatsGrid.innerHTML = cards.length
      ? cards.join('')
      : `<p class="eq-empty-note">Select at least one boat above (Boat Model 1/2/3) to start logging its equipment.</p>`;

    renderIdealSection();
  }

  // ---------------------------------------------------------------------
  // Event delegation handlers
  // ---------------------------------------------------------------------
  function onBoatsGridChange(e) {
    const t = e.target;
    if (!t.matches('[data-field]')) return;
    const boatId = t.dataset.boatId;
    const field = t.dataset.field;

    if (field === 'askingPrice') {
      equipmentState.askingPrices[boatId] = parseFloat(t.value) || 0;
      saveAskingPrices();
      renderAll();
      return;
    }

    const itemId = t.dataset.itemId;
    const item = getEquipmentForBoat(boatId).find(i => i.id === itemId);
    if (!item) return;
    if (field === 'rrp' || field === 'installCost' || field === 'lifeYears') item[field] = parseFloat(t.value) || 0;
    else item[field] = t.value;
    saveData();
    renderAll();
  }

  function onBoatsGridClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const boatId = btn.dataset.boatId;

    if (action === 'toggle-ideal') {
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
      const header = ['Name', 'Category', 'RRP', 'Install Cost', 'Install Date', 'Life Expectancy (yrs)', 'Notes'];
      const lines = [header.join(',')];
      items.forEach(i => {
        lines.push([i.name, i.category, i.rrp, i.installCost, i.installDate, i.lifeYears, i.notes || ''].map(csvEscape).join(','));
      });
      downloadBlob(`${(boat.manufacturer + '-' + boat.name).replace(/\s+/g, '-')}-equipment.csv`, lines.join('\n'), 'text/csv');
    }
  }

  function exportBackup() {
    const payload = {
      equipment: equipmentState.data,
      askingPrices: equipmentState.askingPrices,
      modelBoatId: equipmentState.modelBoatId,
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
      saveData(); saveAskingPrices(); saveModelBoat();
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
  function init() {
    elements.boatsGrid = document.getElementById('equipmentBoatsGrid');
    if (!elements.boatsGrid) return; // Equipment tab not present on this page

    elements.idealContent = document.getElementById('equipmentIdealContent');
    elements.slotTabs = document.getElementById('equipmentSlotTabs');
    elements.fileInput = document.getElementById('equipmentFileInput');
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

    elements.slotTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.equipment-slot-tab');
      if (!btn) return;
      elements.slotTabs.querySelectorAll('.equipment-slot-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      equipmentState.activeSlot = parseInt(btn.dataset.slot, 10);
    });

    elements.fileInput.addEventListener('change', handleFileInput);
    elements.parsePasteBtn.addEventListener('click', () => {
      const rows = parsePastedContent(elements.pasteArea.value);
      if (!rows.length) { showToastLocal('No equipment rows found in that text.'); return; }
      stageRows(rows);
    });
    elements.addManualBtn.addEventListener('click', addManualItem);
    elements.exportBackupBtn.addEventListener('click', exportBackup);
    elements.restoreInput.addEventListener('change', handleRestoreBackup);
    elements.commitBtn.addEventListener('click', commitStaged);
    elements.discardBtn.addEventListener('click', discardStaged);
    elements.stagingTable.addEventListener('change', onStagingChange);

    elements.boatsGrid.addEventListener('click', onBoatsGridClick);
    elements.boatsGrid.addEventListener('change', onBoatsGridChange);

    ['boatSelect1', 'boatSelect2', 'boatSelect3'].forEach(id => {
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
