const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const context = vm.createContext({});
for (const filename of ['data.js', 'calculations.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, filename), 'utf8'), context, { filename });
}
const { boats, math } = vm.runInContext(
  '({ boats: CATAMARAN_DATABASE, math: NAVAL_MATH })', context
);
const legacyIds = [
  'fp-mahe-36', 'fp-lavezzi-40', 'fp-lipari-41', 'fp-orana-44', 'fp-salina-48'
];

function assertFiniteNumbers(value) {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value), `Expected finite number, got ${value}`);
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach(assertFiniteNumbers);
  }
}

test('older Fountaine Pajots are distinct selectable catalogue entries', () => {
  assert.equal(new Set(boats.map(boat => boat.id)).size, boats.length);
  assert.equal(new Set(boats.map(boat => boat.key)).size, boats.length);
  for (const id of legacyIds) {
    const boat = boats.find(entry => entry.id === id);
    assert.ok(boat, `${id} must be available`);
    assert.equal(boat.manufacturer, 'Fountaine Pajot');
    const years = boat.year.match(/(\d{4})\s*-\s*(\d{4})/);
    assert.ok(years, `${id} needs production dates`);
    assert.ok(Number(years[2]) >= 2008, `${id} must overlap the requested model era`);
    assert.match(boat.dataNotes, /estimat/i);
    assert.match(boat.dataNotes, /not.*measured/i);
    assert.doesNotMatch(boat.avgMarketPrice, /YachtWorld avg/);
  }
});

test('added model specifications and polar grids support comparison calculations', () => {
  const referenceSpecs = boats.find(boat => boat.id === 'fp-elba-45').specs;
  const numericSpecs = Object.keys(referenceSpecs)
    .filter(key => typeof referenceSpecs[key] === 'number');
  for (const id of [...legacyIds, 'antares-44']) {
    const boat = boats.find(entry => entry.id === id);
    assert.ok(boat, `${id} must be available`);
    for (const key of numericSpecs) {
      assert.ok(Number.isFinite(boat.specs[key]) && boat.specs[key] > 0, `${id}: ${key}`);
    }
    assert.equal(boat.specs.draft_min_m, boat.specs.draft_max_m);
    assert.ok(Math.abs(boat.specs.sail_area_upwind_m2 -
      boat.specs.mainsail_area_m2 - boat.specs.genoa_area_m2) < 0.01);
    assert.ok(Math.abs((boat.specs.displacement_loaded_t -
      boat.specs.displacement_light_t) * 1000 - boat.specs.payload_capacity_kg) < 0.01);
    for (const tws of [8, 12, 16, 20, 25]) {
      const row = boat.polars[`tws${tws}`];
      assert.equal(row.length, 8, `${id}: tws${tws}`);
      assert.ok(row.every(speed => Number.isFinite(speed) && speed > 0));
    }
    const metrics = math.calculateBoatMetrics(boat);
    assertFiniteNumbers(metrics);
    assert.ok(metrics.raw.estimatedBoatSpeed > 0);
    assert.ok(metrics.raw.upwindTarget.vmg > 0);
    for (const tws of [2, 8, 10, 12, 16, 20, 25, 35, 45]) {
      for (const twa of [30, 35, 45, 60, 90, 110, 135, 150, 180]) {
        const speed = math.predictBasePolarSpeed(boat, tws, twa);
        assert.ok(Number.isFinite(speed) && speed > 0, `${id}: ${tws} kn / ${twa} deg`);
      }
    }
  }
});

test('Antares 44 uses the published metric reference configuration', () => {
  const boat = boats.find(entry => entry.id === 'antares-44');
  assert.ok(boat, 'Antares 44 must be available');
  assert.equal(boat.manufacturer, 'Antares Catamarans');
  assert.equal(boat.key, 'Antares 44');
  const publishedSpecs = {
    loa_m: 13.6, lwl_m: 13.3, boa_m: 6.6, draft_min_m: 1.2,
    displacement_light_t: 8.845, displacement_loaded_t: 10.75,
    mainsail_area_m2: 57, genoa_area_m2: 44, gennaker_code0_m2: 68,
    mast_clearance_m: 18.9, fuel_capacity_l: 455, water_capacity_l: 568
  };
  for (const [key, value] of Object.entries(publishedSpecs)) {
    assert.equal(boat.specs[key], value, `Antares 44: ${key}`);
  }
  assert.match(boat.dataNotes, /not measured manufacturer polars/);
  assert.match(boat.dataNotes, /not a rated capacity/);
  assert.equal(boat.priceEstimate, 'Not assessed');
});

test('existing modern and legacy choices remain available', () => {
  for (const id of ['fp-elba-45', 'fp-tanna-47', 'fp-aura-51', 'lagoon-400',
    'leopard-39', 'leopard-46', 'catana-42', 'catana-50', 'outremer-49',
    'privilege-445', 'neel-45', 'island-spirit-525']) {
    assert.ok(boats.some(boat => boat.id === id), `${id} must remain available`);
  }
});

test('catalogue is ordered by manufacturer, then LOA, then model name', () => {
  for (let index = 1; index < boats.length; index++) {
    const previous = boats[index - 1];
    const current = boats[index];
    const manufacturerOrder = previous.manufacturer.localeCompare(
      current.manufacturer, 'en', { sensitivity: 'base' }
    );
    assert.ok(manufacturerOrder <= 0,
      `${previous.manufacturer} must not precede ${current.manufacturer}`);
    if (manufacturerOrder === 0) {
      assert.ok(previous.specs.loa_m <= current.specs.loa_m,
        `${previous.name} (${previous.specs.loa_m} m) must not precede ${current.name} (${current.specs.loa_m} m)`);
      if (previous.specs.loa_m === current.specs.loa_m) {
        assert.ok(previous.name.localeCompare(current.name, 'en',
          { sensitivity: 'base', numeric: true }) <= 0);
      }
    }
  }
  const fp = boats.filter(boat => boat.manufacturer === 'Fountaine Pajot');
  assert.equal(fp[0].id, 'fp-mahe-36');
  assert.ok(fp.findIndex(boat => boat.id === 'fp-lavezzi-40') <
    fp.findIndex(boat => boat.id === 'fp-salina-48'));
  const islandSpirit = boats.filter(boat => boat.manufacturer === 'Island Spirit');
  assert.deepEqual(Array.from(islandSpirit, boat => boat.id),
    ['island-spirit-40', 'island-spirit-525']);
});
