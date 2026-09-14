(() => {
  'use strict';

  const state = { tws: 16, twa: 90 };
  const elements = {
    twsInput: document.getElementById('twsInput'),
    twaInput: document.getElementById('twaInput'),
    twsValue: document.getElementById('twsValue'),
    twaValue: document.getElementById('twaValue'),
    conditionReadout: document.getElementById('conditionReadout'),
    fleetCount: document.getElementById('fleetCount'),
    graph: document.getElementById('graph'),
    resetBtn: document.getElementById('resetBtn')
  };

  function formatSpeed(speed) {
    return `${speed.toFixed(1)} kn`;
  }

  function classifySpeed(boat, speed) {
    const boatType = (boat && boat.category) ? boat.category.toLowerCase() : '';
    const isCruisingDesign = /(cruising|luxury|charter|bluewater|fun-sailer)/i.test(boatType);
    const isPerformanceDesign = /(performance|racer|race|sport|high-performance|ultra high-performance|fast cruising)/i.test(boatType);

    if (speed < 8.5) return 'Slow';

    if (isCruisingDesign) {
      if (speed < 10.0) return 'Slow';
      if (speed < 12.0) return 'Cruiser';
      if (speed < 14.5) return 'Performance';
      return 'Performance';
    }

    if (isPerformanceDesign) {
      if (speed < 11.5) return 'Performance';
      if (speed < 15.5) return 'Performance';
      return 'Racer';
    }

    if (speed < 10.5) return 'Cruiser';
    if (speed < 14.0) return 'Performance';
    return 'Racer';
  }

  function update() {
    const results = CATAMARAN_DATABASE
      .map(boat => ({
        boat,
        speed: NAVAL_MATH.predictBasePolarSpeed(boat, state.tws, state.twa)
      }))
      .sort((left, right) => right.speed - left.speed);
    const maxSpeed = Math.max(...results.map(result => result.speed), 1);

    elements.twsValue.value = `${state.tws} kn`;
    elements.twaValue.value = `${state.twa}°`;
    elements.conditionReadout.textContent = `${state.tws} kn TWS · ${state.twa}° TWA`;
    elements.fleetCount.textContent = `${results.length} boats ranked`;

    elements.graph.innerHTML = results.map((result, index) => {
      const category = classifySpeed(result.boat, result.speed);
      const width = Math.max(3, (result.speed / maxSpeed) * 100);
      return `
        <article class="speed-row">
          <div class="rank">${String(index + 1).padStart(2, '0')}</div>
          <div class="boat-label">
            <strong>${result.boat.name}</strong>
            <span>${result.boat.manufacturer} · ${result.boat.specs.loa_m.toFixed(1)} m</span>
          </div>
          <div class="bar-track" aria-label="${result.boat.manufacturer} ${result.boat.name}: ${formatSpeed(result.speed)}">
            <div class="bar-fill ${category.toLowerCase()}" style="width: ${width}%"></div>
          </div>
          <div class="speed-value"><strong>${formatSpeed(result.speed)}</strong><span>${category}</span></div>
        </article>
      `;
    }).join('');
  }

  function setTwa(value) {
    state.twa = Number(value);
    elements.twaInput.value = state.twa;
    update();
  }

  elements.twsInput.addEventListener('input', event => {
    state.tws = Number(event.target.value);
    update();
  });

  elements.twaInput.addEventListener('input', event => setTwa(event.target.value));

  document.querySelectorAll('[data-twa]').forEach(button => {
    button.addEventListener('click', () => setTwa(button.dataset.twa));
  });

  elements.resetBtn.addEventListener('click', () => {
    state.tws = 16;
    state.twa = 90;
    elements.twsInput.value = state.tws;
    elements.twaInput.value = state.twa;
    update();
  });

  update();
})();
