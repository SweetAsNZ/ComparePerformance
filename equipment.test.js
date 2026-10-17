const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadEquipment(currency = 'USD') {
  const storage = new Map();
  const context = vm.createContext({
    console,
    URL,
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    document: {
      addEventListener() {},
      getElementById: id => id === 'equipmentImportCurrency' ? { value: currency } : null
    }
  });
  context.window = context;
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'equipment-pricing.js'), 'utf8'), context);
  const source = fs.readFileSync(path.join(__dirname, 'equipment.js'), 'utf8');
  vm.runInContext(source.replace("document.addEventListener('DOMContentLoaded', init);",
    `globalThis.api = { parseFreeText, parseCSV, parsePdfFile, pdfTextLines, enrichPrice, renderPriceInfo,
      renderQuoteEditor, computeItemMetrics, equipmentState, renderBoatCard, syncImportTarget, stageRows,
      renderStaging, commitStaged, discardStaged, onStagingChange, elements };`), context);
  return context;
}

test('pending import follows model identity and preserves edits, selections and collapsed state', () => {
  const context = loadEquipment();
  const { api } = context;
  context.CATAMARAN_DATABASE = [{ id: 'elba' }, { id: 'saona' }];
  const selectors = { boatSelect1: { value: 'elba' }, boatSelect2: { value: 'saona' } };
  context.document.getElementById = id => selectors[id];
  Object.assign(api.elements, {
    pasteArea: { value: '' }, fileInput: { value: '' }, folderInput: { value: '' }
  });
  api.syncImportTarget();
  api.equipmentState.pendingImport = [{ name: 'Elba PDF row edited', _checked: true, rrp: 100 }];
  api.equipmentState.stagingCollapsed = true;
  api.elements.pasteArea.value = 'Elba pasted text';
  selectors.boatSelect1.value = 'saona';
  api.syncImportTarget();
  assert.equal(api.equipmentState.pendingImport.length, 0);
  assert.equal(api.elements.pasteArea.value, '');
  api.equipmentState.pendingImport = [{ name: 'Saona PDF row', _checked: false }];
  selectors.boatSelect1.value = 'elba';
  api.syncImportTarget();
  assert.equal(api.equipmentState.pendingImport[0].name, 'Elba PDF row edited');
  assert.equal(api.equipmentState.pendingImport[0]._checked, true);
  assert.equal(api.equipmentState.stagingCollapsed, true);
  assert.equal(api.elements.pasteArea.value, 'Elba pasted text');
  api.equipmentState.activeSlot = 2;
  api.syncImportTarget();
  assert.equal(api.equipmentState.pendingImport[0].name, 'Saona PDF row');
  selectors.boatSelect2.value = '';
  api.syncImportTarget();
  assert.equal(api.equipmentState.pendingImport.length, 0);
  assert.equal(api.equipmentState.importBoatId, null);
  api.stageRows([{ name: 'Import completed after switching away', kind: 'equipment', rrp: 1 }], 'elba');
  assert.equal(api.equipmentState.pendingImport.length, 0);
  selectors.boatSelect2.value = 'elba';
  api.syncImportTarget();
  assert.equal(api.equipmentState.pendingImport[0].name, 'Import completed after switching away');
});

test('PDF rows join near-identical baselines and sort columns left to right', () => {
  const { api } = loadEquipment();
  const lines = api.pdfTextLines([
    { str: '900 Amps - 6 AGM Batteries', transform: [1, 0, 0, 1, 215, 264.6] },
    { str: 'Battery House', transform: [1, 0, 0, 1, 30, 264.3119] },
    { str: 'Radar', transform: [1, 0, 0, 1, 30, 408.5279] },
    { str: 'Garmin Fantom 18', transform: [1, 0, 0, 1, 215, 408.12] }
  ]);
  assert.deepEqual(Array.from(lines), ['Radar Garmin Fantom 18', 'Battery House 900 Amps - 6 AGM Batteries']);
});

test('PDF import releases the loading task, including textless PDFs', async () => {
  const context = loadEquipment();
  let destroyed = 0;
  let items = [{ str: 'Garmin GMI 20', transform: [1, 0, 0, 1, 30, 100] }];
  context.pdfjsLib = {
    getDocument: () => ({
      promise: Promise.resolve({ numPages: 1, getPage: async () => ({ getTextContent: async () => ({ items }) }) }),
      destroy: async () => { destroyed++; }
    })
  };
  const file = { arrayBuffer: async () => new ArrayBuffer(0) };
  const rows = await context.api.parsePdfFile(file, 'test.pdf');
  assert.equal(rows[0].name, 'Garmin GMI 20');
  assert.equal(destroyed, 1);
  items = [];
  await assert.rejects(context.api.parsePdfFile(file, 'test.pdf'), /No selectable text/);
  assert.equal(destroyed, 2);
});

test('dimensions, RPM, hours, model versions and years are not money', () => {
  const { api } = loadEquipment();
  const rows = api.parseFreeText([
    'Fuel Consumption 2.5 L / Engine / Hr @ 1,800 RPM @ 6 Knots',
    'Generator 1,190 hours', 'Length 13.46m / 44.16ft', 'Draft 1.20m / 3.94ft',
    'Model Elba 45', 'History and details v0.1', 'Engine year 2021',
    'past 5 years (circa EUR 25,000)', 'Total investment circa EUR 130,000'
  ].join('\n'), 'test.pdf');
  assert.ok(rows.length >= 3);
  assert.ok(rows.every(row => row.rrp === 0 && row.installCost === 0));
  assert.ok(rows.every(row => !row.priceInfo));
});

test('explicit and unlabelled invoice amounts convert into USD with dated provenance', () => {
  const { api, EQUIPMENT_PRICING: prices } = loadEquipment('NZD');
  for (const [line, currency, amount] of [
    ['Chartplotter NZD 1,765.60', 'NZD', 1765.60],
    ['Chartplotter £749.89', 'GBP', 749.89],
    ['Chartplotter 888.65 EUR', 'EUR', 888.65],
    ['Chartplotter $1,765.60', 'NZD', 1765.60],
    ['Chartplotter 1,765.60', 'NZD', 1765.60]
  ]) {
    const row = api.parseFreeText(line)[0];
    assert.equal(row.rrp, prices.toUSD(amount, currency), line);
    assert.equal(row.priceInfo.currency, currency);
    assert.equal(row.priceInfo.fxDate, '2026-10-16');
  }
});

test('CSV Currency column and explicit Kind take precedence; price metadata round trips', () => {
  const { api } = loadEquipment('NZD');
  const row = api.parseCSV('Name,Cost,Currency,Kind\nGarmin GMI 20,100,USD,equipment', 'Spares.csv', 'spare')[0];
  assert.equal(row.rrp, 100);
  assert.equal(row.kind, 'equipment');
  const encoded = JSON.stringify(row.priceInfo).replace(/"/g, '""');
  const restored = api.parseCSV(`Name,RRP,Currency,Price Reference\nGarmin GMI 20,100,USD,"${encoded}"`)[0];
  assert.equal(restored.priceInfo.status, 'document');
  assert.equal(restored.priceInfo.currency, 'USD');
});

test('spare service kits stay spares and spares section context ends at the next section', () => {
  const { api } = loadEquipment();
  assert.equal(api.parseFreeText('Johnson Service Kit Model 09-45587', '', 'spare')[0].kind, 'spare');
  const rows = api.parseFreeText('Engine Spares package:\nOil Filters\nFan Belts\nGenerator\nFischer Panda 15000i');
  assert.deepEqual(Array.from(rows, row => row.kind), ['spare', 'spare', 'equipment']);
});

test('long narrative imports are not silently cut off and descriptions are not truncated', () => {
  const { api } = loadEquipment();
  const rows = api.parseFreeText(Array.from({ length: 450 }, (_, i) => `Distinct equipment item ${i} ${'description '.repeat(10)}`).join('\n'));
  assert.equal(rows.length, 450);
  assert.ok(rows[449].name.length > 80);
  assert.match(rows[449].name, /449/);
});

test('only identifiable complete replacement rows receive price estimates', () => {
  const { api } = loadEquipment();
  const row = api.enrichPrice(api.parseFreeText('AIS Auto ID System 2 Garmin GMI 20')[0]);
  assert.equal(row.rrp, 999.98);
  assert.equal(row.priceInfo.quantity, 2);
  assert.equal(api.enrichPrice({ name: 'Garmin GMI 20 x 2', kind: 'equipment', rrp: 0 }).rrp, 999.98);
  assert.match(api.renderPriceInfo(row), /Price source/);
  for (const name of ['Fortress FX37 with 80m of rode', 'Fortress FX37 and Fortress FX11', 'Used Fortress FX55', 'Oil Filter', 'Garmin GMI 20, Garmin GMI 20']) {
    const item = api.enrichPrice({ name, kind: 'spare', rrp: 0 });
    assert.equal(item.rrp, 0, name);
  }
  const maintenance = api.enrichPrice({ name: 'Johnson Service Kit Model 09-45587', kind: 'maintenance', rrp: 0 });
  assert.equal(maintenance.rrp, 0);
});

test('GBP replacement quote is converted, sourced and never overwrites a document cost', () => {
  const { api, EQUIPMENT_PRICING: prices } = loadEquipment();
  const row = api.enrichPrice(api.parseFreeText('Johnson Service Kit Model 09-45587', '', 'spare')[0]);
  assert.equal(row.rrp, 73.33);
  assert.equal(row.priceInfo.currency, 'GBP');
  assert.match(row.priceInfo.url, /simplybrandsdirect/);
  assert.match(api.renderPriceInfo(row), /FX source/);
  const existing = api.enrichPrice({ name: row.name, kind: 'spare', rrp: 10 });
  assert.equal(existing.rrp, 10);
  assert.equal(prices.quote(176.56, 'NZD', 'https://example.com/quote').usd, 100);
  assert.throws(() => prices.quote(10, 'XYZ', 'https://example.com'), /Unsupported currency/);
  assert.throws(() => prices.quote(10, 'USD', 'javascript:alert(1)'), /source URL/);
  assert.throws(() => prices.toUSD(-1, 'USD'), /non-negative/);
});

test('unpriced and estimated values are distinguishable and unsafe source URLs are not links', () => {
  const { api } = loadEquipment();
  assert.match(api.renderPriceInfo({ rrp: 0 }), /Needs price/);
  assert.match(api.renderPriceInfo({ rrp: 10 }), /Entered USD/);
  const markup = api.renderPriceInfo({ priceInfo: { status: 'estimate', model: '<script>', url: 'javascript:alert(1)' } });
  assert.ok(!markup.includes('href='));
  assert.ok(!markup.includes('<script>'));
  assert.equal(api.renderQuoteEditor({ kind: 'maintenance' }, ''), '');
});

test('existing straight-line and engine-hours depreciation calculations are unchanged', () => {
  const { api } = loadEquipment();
  const item = { rrp: 1000, installCost: 200, lifeYears: 10, installDate: '2021-01-01', hours: 2500, lifeHours: 5000 };
  const metrics = api.computeItemMetrics(item, new Date('2026-01-01'));
  assert.equal(metrics.currentValue, 600);
  assert.equal(metrics.accruedDepreciation, 600);
  assert.equal(metrics.status, 'ok');
});

function stagingHarness() {
  const context = loadEquipment();
  const boat = { id: 'elba', name: 'Elba 45', manufacturer: 'Fountaine Pajot' };
  context.CATAMARAN_DATABASE = [boat];
  context.document.getElementById = id => id === 'boatSelect1' ? { value: boat.id } : null;
  const element = () => ({ value: '', textContent: '', innerHTML: '', classList: { toggle() {} } });
  Object.assign(context.api.elements, {
    pasteArea: element(), fileInput: element(), folderInput: element(),
    stagingWrap: element(), stagingTable: element(), stagingCount: element(), commitBtn: element()
  });
  context.api.syncImportTarget();
  return { ...context, api: context.api, boat };
}

test('PDF candidates show a pending review banner, not a misleading no-equipment message', () => {
  const { api, boat } = stagingHarness();
  api.stageRows([{ id: 'pump', name: 'Pump', kind: 'equipment', rrp: 0 }]);
  const card = api.renderBoatCard(1, boat, []);
  assert.match(card, /1 imported rows awaiting review/);
  assert.match(card, /Review imported rows/);
  assert.doesNotMatch(card, /No equipment logged yet/);
  api.renderStaging();
  assert.match(api.elements.stagingCount.textContent, /NOT ADDED to Elba 45/);
  assert.equal(api.elements.commitBtn.disabled, false);
  assert.match(api.elements.commitBtn.textContent, /Add 1 checked row/);
});

test('only checked rows are saved to the correct kind; unchecked candidates remain reviewable', () => {
  const { api, boat } = stagingHarness();
  api.stageRows([
    { id: 'display', name: 'Display', kind: 'equipment', rrp: 100 },
    { id: 'kit', name: 'Service kit', kind: 'spare', rrp: 20 },
    { id: 'service', name: 'Engine service', kind: 'maintenance', rrp: 50 },
    { id: 'unreviewed', name: 'Unreviewed', kind: 'equipment', rrp: 0 }
  ]);
  api.equipmentState.pendingImport[3]._checked = false;
  api.commitStaged();
  assert.deepEqual(Array.from(api.equipmentState.data[boat.id], row => row.kind), ['equipment', 'spare']);
  assert.equal(api.equipmentState.maintenanceLog[boat.id][0].cost, 50);
  assert.equal(api.equipmentState.pendingImport.length, 1);
  assert.equal(api.equipmentState.pendingImport[0].id, 'unreviewed');
  assert.equal(api.elements.commitBtn.disabled, true);
  api.discardStaged();
  api.renderStaging();
  assert.equal(api.elements.stagingCount.textContent, '');
  assert.equal(api.elements.commitBtn.disabled, true);
});

test('large imports require explicit selection and update the checked count immediately', () => {
  const { api } = stagingHarness();
  api.stageRows(Array.from({ length: 41 }, (_, i) => ({ name: `Item ${i}`, kind: 'equipment', rrp: 0 })));
  api.renderStaging();
  assert.equal(api.elements.commitBtn.disabled, true);
  api.onStagingChange({ target: { dataset: { rowIdx: '0', field: '_checked' }, checked: true } });
  assert.equal(api.elements.commitBtn.disabled, false);
  assert.match(api.elements.stagingCount.textContent, /1 checked/);
});

test('expanded price references cover real-fixture electronics, controllers and exact spare kits', () => {
  const { EQUIPMENT_PRICING: prices } = loadEquipment();
  for (const [name, expected] of [
    ['Garmin Airmar DST 810 Transducer', 449.99],
    ['Garmin Panoptix PS51-TH', 1599.99],
    ['Garmin AIS – 800 Blackbox Transceiver', 859.99],
    ['Victron GX50 Colour Touch screen', 220.15],
    ['Three 100/30 amp Victron MPPTs solar controllers', 405.45],
    ['Whale Box Service Kit Gulper 220 Pump', 42.70],
    ["Harken Bosun's Chair", 269.15],
    ['2 x Victron Compact MultiPlus 12V 2000VA', 2021.30],
    ['Schenker Zen 12V 100L/h', 13800],
    ['PredictWind DataHub', 299]
  ]) {
    const result = prices.lookup(name);
    assert.equal(result?.usd, expected, name);
    assert.ok(result.url.startsWith('https:'));
  }
  const quote = prices.lookup('Garmin GPSMAP 8412');
  assert.equal(quote.usd, prices.toUSD(3000.49, 'GBP'));
  assert.equal(quote.fxDate, prices.fx.date);
});

test('bundles expose sourced per-unit research without treating a partial price as their total', () => {
  const { api, EQUIPMENT_PRICING: prices } = loadEquipment();
  for (const name of [
    'Fortress FX37 with chain and Fortress FX11',
    'Victron Cerbo GX and GX Touch 50',
    'Highfield Classic CL 360 tender with a 20HP Yamaha motor',
    'Three Sunpower panels and Victron MPPT 250/100',
    'Garmin Reactor 40 plus GHC 20',
    'VHF Garmin 315i with active speaker at Navigation Station',
    'Wind Generator 1200w 3 Sunpower 400w Solar Panels plus Victron 250 / 100 MMPT SmartSolar',
    'Notes PredictWind DataHub linking to PredictWind page. AIS MOB Ocean Safety alarm',
    'Ultra-Marine UFS 13 swivel',
    'Garmin Wind Sensor (GND10)',
    'Victron 5KW Quattro and 2KW Multiplus Charger/Inverter'
  ]) {
    const row = api.enrichPrice({ name, kind: 'equipment', rrp: 0 });
    assert.equal(row.rrp, 0, name);
    assert.ok(prices.research(name).components.length > 0, name);
    assert.match(api.renderPriceInfo(row), /not included in this row total/);
  }
  const bundle = prices.research('Fortress FX37 and Fortress FX11');
  assert.equal(bundle.components.length, 2);
  assert.equal(prices.research('VHF Garmin 315i with active speaker at Navigation Station').components[0].amount, 740);
  assert.equal(prices.research('3 Sunpower 400w Solar Panels plus Victron 250 / 100 MMPT SmartSolar').components[0].amount, 643.45);
  assert.equal(prices.lookup('Whale Gulper 220 pump'), null);
  assert.equal(prices.lookup('Garmin GPSMAP 8412xsv'), null);
  assert.equal(prices.lookup('Garmin GMI 20 cover'), null);
  assert.equal(prices.lookup('PredictWind DataHub Pro'), null);
  assert.match(api.renderPriceInfo({ name: 'Onan 9.5 MDKDM', kind: 'equipment', rrp: 0 }), /Dealer quote required/);
  const historical = api.enrichPrice({ name: 'Garmin 8612 Chartplotter (replaced under warranty)', kind: 'maintenance', rrp: 0 });
  assert.equal(historical.rrp, 0);
  assert.match(api.renderPriceInfo(historical), /not evidence of historical maintenance spend/);
  assert.match(api.renderPriceInfo(historical), /2556.4/);
});
