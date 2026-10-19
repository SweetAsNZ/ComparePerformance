/* Public replacement-price references, not the boat owner's historical purchase costs. */
(function (root) {
  'use strict';

  const checkedDate = '2026-10-17';
  const fx = {
    date: '2026-10-16',
    source: 'https://api.frankfurter.dev/v1/2026-10-16?base=USD&symbols=NZD,AUD,GBP,EUR,CAD',
    perUSD: { USD: 1, NZD: 1.7656, AUD: 1.437, GBP: 0.74989, EUR: 0.88865, CAD: 1.4161 }
  };
  const references = [
    { pattern: /\bFortress\b.*\bFX[- ]?11\b/i, model: 'Fortress FX-11', amount: 284.99, currency: 'USD',
      url: 'https://fortressanchors.com/product/fortress-anchor-fx-11/' },
    { pattern: /\bFortress\b.*\bFX[- ]?37\b/i, model: 'Fortress FX-37', amount: 1058.99, currency: 'USD',
      url: 'https://fortressanchors.com/product/fortress-anchor-fx-37/' },
    { pattern: /\bFortress\b.*\bFX[- ]?55\b/i, model: 'Fortress FX-55', amount: 1549.99, currency: 'USD',
      url: 'https://fortressanchors.com/product/fortress-anchor-fx-55/' },
    { pattern: /\bJohnson\b.*\b09-45587\b/i, model: 'Johnson 09-45587 service kit', amount: 54.99, currency: 'GBP',
      url: 'https://simplybrandsdirect.com/johnson-f4b-8-f4b-9-pumps-service-repair-kit/' },
    { pattern: /\bVolvo\b.*\b22030848\b/i, model: 'Volvo Penta 22030848 oil filter', amount: 54.30, currency: 'USD',
      url: 'https://www.wholesalemarine.com/volvo-penta-22030848-oil-filter/' },
    { pattern: /\bGarmin\s+GMI\s*20\b/i, model: 'Garmin GMI 20', amount: 499.99, currency: 'USD',
      url: 'https://www.tackledirect.com/garmin-010-01140-00-gmi-20-marine-instrument-display.html' },
    { pattern: /\b(?:rescue\s?me\s+)?PLB[- ]?1\b/i, model: 'Ocean Signal rescueME PLB1', amount: 399.95, currency: 'USD',
      url: 'https://www.thegpsstore.com/Marine-Electronics/Safety-Equipment/Ocean-Signal-PLB1-rescueME-Personal-Locator-Beacon' },
    { pattern: /\b(?:Garmin\s+|Airmar\s+)?DST[- ]?810\b/i, model: 'Garmin / Airmar DST810', amount: 449.99, currency: 'USD',
      note: '0-degree plastic transducer reference; confirm hull angle.',
      url: 'https://www.hodgesmarine.com/gar010-11051-20-garmin-airmar-dst-810-smart-transducer-0deg.html' },
    { pattern: /\b(?:Garmin\s+|Panoptix\s+)?PS51[- ]?TH\b/i, model: 'Garmin Panoptix PS51-TH', amount: 1599.99, currency: 'USD',
      url: 'https://www.tackledirect.com/garmin-010-01753-00-panoptix-ps51-th-livevu-forward-transducer.html' },
    { pattern: /\b(?:Garmin\s+)?GHC\s*20\b/i, model: 'Garmin GHC 20 display', amount: 649.99, currency: 'USD',
      note: 'Display only, not a complete autopilot.',
      url: 'https://www.tackledirect.com/garmin-010-01141-00-ghc-20-display-unit.html' },
    { pattern: /\b(?:Garmin\s+)?GNX\s*Wind\b/i, model: 'Garmin GNX Wind', amount: 375.20, currency: 'USD',
      note: 'Advertised sale price; backorder / availability must be confirmed.',
      url: 'https://www.hodgesmarine.com/gar010-01142-30-garmin-gnx-wind-display.html' },
    { pattern: /\b(?:Garmin\s+)?AIS\s*[-\u2013\u2014]?\s*800\b/i, model: 'Garmin AIS 800', amount: 859.99, currency: 'USD',
      url: 'https://www.hodgesmarine.com/gar010-02087-00-garmin-aistrade-800-blackbox-transceiver.html' },
    { pattern: /\b(?:Garmin\s*(?:GPSMAP\s*)?|GPSMAP\s*)8412\b(?!\s*xsv)/i, model: 'Garmin GPSMAP 8412 (non-xsv)', amount: 3000.49, currency: 'GBP',
      url: 'https://rowlandsmarine.co.uk/garmin-gpsmap-8412-12-multifunction-display/' },
    { pattern: /\b(?:Garmin\s*(?:GPSMAP\s*)?|GPSMAP\s*)8410\b(?!\s*xsv)/i, model: 'Garmin GPSMAP 8410 (non-xsv)', amount: 2150.49, currency: 'GBP',
      url: 'https://rowlandsmarine.co.uk/garmin-gpsmap-8410-10-multifunction-display/' },
    { pattern: /\b(?:Garmin\s*(?:GPSMAP\s*)?|GPSMAP\s*)8612\b(?!\s*xsv)/i, model: 'Garmin GPSMAP 8612 (non-xsv)', amount: 2556.40, currency: 'USD',
      note: 'GN+ chart bundle reference; confirm chart region.',
      url: 'https://www.hodgesmarine.com/gar010-02092-50-garmin-gpsmapreg-8612-chartplotter-gn.html' },
    { pattern: /\b(?:Garmin\s*(?:GPSMAP\s*)?|GPSMAP\s*)8610\b(?!\s*xsv)/i, model: 'Garmin GPSMAP 8610 (non-xsv)', amount: 2799.99, currency: 'USD',
      note: 'GN+ chart bundle reference; confirm chart region.',
      url: 'https://www.hodgesmarine.com/gar010-02091-50-garmin-gpsmapreg-8610-chartplotter-gn.html' },
    { pattern: /\b(?:Garmin\s+)?GHS\s*11i\b/i, model: 'Garmin GHS 11i handset', amount: 229.95, currency: 'GBP',
      note: 'Wired international handset, not the complete radio.',
      url: 'https://www.marinesuperstore.com/marine-communication/communication-accessories/garmin-ghs-11i-wired-vhf-remote-handset' },
    { pattern: /\b(?:Garmin\s+(?:VHF\s*)?|VHF\s*(?:Garmin\s*)?)315i\b/i, model: 'Garmin VHF 315i radio kit', amount: 740, currency: 'GBP',
      note: 'Kit includes one GHS 11i handset and active speaker. Do not count its included handset twice.',
      url: 'https://www.marinechandlery.com/products/garmin-vhf-315i-marine-radio-c-w-ghs-11i-handset-active-speaker' },
    { pattern: /\b(?:SmartSolar|Victron\b.*?MPPT|MPPT)\s*100\s*\/\s*30\b|\b100\s*\/\s*30\b(?=.*\bVictron\b.*?\bMPPTs?\b)/i, model: 'Victron SmartSolar MPPT 100/30', amount: 135.15, currency: 'USD',
      url: 'https://www.invertersupply.com/index.php?main_page=product_info&products_id=21222' },
    { pattern: /\b(?:SmartSolar|Victron\b.*?MPPT|MPPT)\s*150\s*\/\s*60\b|\b150\s*\/\s*60\b(?=.*\bVictron\b.*?\bMPPTs?\b)/i, model: 'Victron SmartSolar MPPT 150/60-Tr', amount: 368.90, currency: 'USD',
      note: 'Tr terminal reference; confirm terminal variant.',
      url: 'https://www.invertersupply.com/index.php?main_page=product_info&products_id=200271' },
    { pattern: /\b(?:SmartSolar|Victron\b.*?MPPT|MPPT)\s*250\s*\/\s*100\b|\b250\s*\/\s*100\b(?=.*\b(?:MM?PT|SmartSolar)\b)/i, model: 'Victron SmartSolar MPPT 250/100-Tr VE.Can', amount: 643.45, currency: 'USD',
      note: 'SmartSolar Tr VE.Can reference; confirm controller family and terminals.',
      url: 'https://www.invertersupply.com/index.php?main_page=product_info&products_id=200272' },
    { pattern: /\b(?:Compact\s*MultiPlus|MultiPlus\s*Compact)\b.*?\b(?:12\s*[V/ -]\s*)?2000\s*(?:VA|\b)/i,
      model: 'Victron MultiPlus Compact 12/2000/80-30 230V', amount: 1010.65, currency: 'USD',
      note: '12V / 230V / 80A charger reference; confirm charger and output specification.',
      url: 'https://www.invertersupply.com/index.php?main_page=product_info&products_id=189668' },
    { pattern: /\b(?:GX\s*Touch\s*50|GX\s*50\s*(?:Colour\s*)?Touch)\b/i, model: 'Victron GX Touch 50', amount: 220.15, currency: 'USD',
      note: 'Original 5-inch display only; Cerbo controller is separate.',
      url: 'https://www.invertersupply.com/index.php?main_page=product_info&products_id=195622' },
    { pattern: /\bWhale\b.*?\b(?:Gulper\s*220|AK1550)\b/i, model: 'Whale AK1550 Gulper 220 service kit', amount: 42.70, currency: 'USD',
      requires: /\b(?:kit|AK1550)\b/i,
      url: 'https://us.binnacle.com/whale-ak1550-gulper-220-service-kit' },
    { pattern: /\bHarken\b.*?\b(?:bosun|bosun['’]s)\b/i, model: 'Harken 2234 Deluxe bosun chair', amount: 269.15, currency: 'USD',
      note: 'Selected replacement basis: Deluxe 2234; original chair model not specified. Available to order.',
      url: 'https://sailingservices.com/products/h2234-deluxe-bosuns-chair-from-harken' },
    { pattern: /\bUltra\b.*?\b(?:35\s*kg|UA35)\b/i, model: 'Ultra UA35 35kg anchor', amount: 3039, currency: 'EUR',
      note: 'Manufacturer price excluding VAT, shipping and installation; anchor only.',
      url: 'https://www.ultramarine-anchors.com/anchor' },
    { pattern: /\b(?:Schenker\b.*?\bZEN\s*100|Schenker\b.*?\bZEN\b.*?\b100\s*L)/i,
      model: 'Schenker ZEN 100 12V BASIC', amount: 13800, currency: 'USD',
      note: 'Basic control-panel replacement basis; excludes installation and optional touch controls.',
      url: 'https://titanmarineair.com/product/zen-100-basic-12v/' },
    { pattern: /\bHighfield\b.*?\bCL\s*360\b/i, model: 'Highfield Classic CL360 Hypalon', amount: 8929, currency: 'USD',
      note: 'Hypalon hull-only advertised sale price. Outboard and accessories are separate.',
      url: 'https://www.boatspecialists.com/highfield-classic-360-rib-cl360/' },
    { pattern: /\bUltra[- ]?(?:Marine\b.*?)?\s*UFS\s*13(?:[- ]60)?\b/i, model: 'Ultra UFS 13-60 flip swivel', amount: 554, currency: 'EUR',
      reviewOnly: true, note: 'Excluding VAT and delivery. Confirm full UFS 13-60 suffix and chain/anchor compatibility.',
      url: 'https://www.ultramarine-anchors.com/flip-swivel-hook' },
    { pattern: /\bCerbo\s*GX\b/i, model: 'Victron Cerbo GX MK2 replacement', amount: 272.85, currency: 'USD',
      reviewOnly: true, note: 'Current MK2 replacement reference, not an assertion that the installed original is MK2. Confirm interfaces.',
      url: 'https://www.invertersupply.com/index.php?main_page=product_info&products_id=204838' },
    { pattern: /\bQuattro\b|\bVictron\s*5\s*kW\b/i, model: 'Victron Quattro 12/5000/220 230V', amount: 2671.60, currency: 'USD',
      reviewOnly: true, note: '12V / 230V / 5000VA replacement basis; PDF says 5kW. Confirm full rating, output voltage and charger before applying.',
      url: 'https://www.solar-electric.com/victron-energy-quattro-inverter-12-5000-220-230vac.html' },
    { pattern: /\bGND\s*10\b/i, model: 'Garmin GND 10 black box bridge', amount: 228.97, currency: 'USD',
      reviewOnly: true, note: 'Advertised price, currently sold out. Bridge only, not a wind sensor/system.',
      url: 'https://www.marinepartsonly.com/products/garmin-gnd-10-black-box-bridge-nexus-to-nmea-2000-data-converter-for-marine-instruments-and-sensors' },
    { pattern: /\b(?:PredictWind\s*)?DataHub\b(?!\s*Pro)/i, model: 'PredictWind DataHub (original)', amount: 299, currency: 'USD',
      note: 'Hardware only; subscriptions are not included. Not the Pro model.',
      url: 'https://www.predictwind.com/datahub/family' },
    { pattern: /\b(?:Victron\s+)?Ekrano\s*GX\b/i, model: 'Victron Ekrano GX', amount: 619.65, currency: 'USD',
      note: 'BPP900480100 integrated controller/display. Reported owner installation on Excess 12; not a blanket suitability recommendation.',
      url: 'https://www.invertersupply.com/index.php?main_page=product_info&products_id=203093' },
    { pattern: /\b(?:Victron\s+)?SmartSolar\s*(?:MPPT\s*)?75\s*\/\s*15\b/i, model: 'Victron SmartSolar MPPT 75/15', amount: 70.55, currency: 'USD',
      note: 'SCC075015060R SmartSolar replacement basis for an Excess 12 owner-reported MPPT 75/15; confirm controller family and array sizing.',
      url: 'https://www.invertersupply.com/index.php?main_page=product_info&products_id=31071' }
  ];
  const researchNotes = [
    { pattern: /\b(?:Onan|MDKDM)\b/i, model: 'Onan generator', note: 'Dealer quote required for the exact generator, voltage and installation.', url: 'https://www.cummins.com/generators/marine' },
    { pattern: /\bFischer\s*Panda\b|\bPanda\s*15000i\b/i, model: 'Fischer Panda 15000i', note: 'Dealer quote required; confirm 230V / 50Hz configuration.', url: 'https://www.onefischerpanda.com/marine/marine-generators/iseries-generator-50-hz/panda-15000i-230-v/' },
    { pattern: /\bVolvo\b.*?\bD2[- ]?60F?\b/i, model: 'Volvo Penta D2-60', note: 'Engine / saildrive configuration and serial number are needed for a dealer quote; spare parts need part numbers.', url: 'https://www.volvopenta.com/marine/products/sailing/' },
    { pattern: /\b(?:Aquabase|Aqua[- ]Base|ESW901)\b/i, model: 'Aqua-Base ESW901', note: 'Confirm manual/automatic controls and DC voltage before using a current Eco 105 L/h replacement price.', url: 'https://en.comptoirnautique.com/watermaker/30751-aqua-base-eco-automatic-watermaker-105-l-h.html' },
    { pattern: /\bFantom\s*18x?\b/i, model: 'Garmin Fantom radar', note: 'Original Fantom 18 is 40W; 18x is 50W. Confirm the model before pricing.', url: 'https://www.firstchoicemarine.com/products/garmin-gmr-fantom-18-radar-010-01706-00' },
    { pattern: /\bReactor\s*40\b/i, model: 'Garmin Reactor 40 autopilot', note: 'Confirm corepack, pump/drive and included display; these are separately priced configurations.', url: 'https://www.garmin.com/en-US/c/marine-autopilots/' },
    { pattern: /\b(?:Cerbo\s*GX|Quattro|MultiPlus)\b/i, model: 'Victron controller / inverter', note: 'Confirm generation, DC/output voltage and full model rating; do not count repeated charger/inverter descriptions twice.', url: 'https://www.victronenergy.com/' },
    { pattern: /\bLewmar\b.*?\b(?:EVO\s*)?(?:50|55)\b/i, model: 'Lewmar winch', note: 'Confirm manual/electric, motor voltage, finish and complete kit versus winch-only before pricing.', url: 'https://www.lewmar.com/' },
    { pattern: /\b(?:Starlink|Sunpower|Maxeon)\b/i, model: 'Communications / solar', note: 'Confirm exact hardware generation or panel part number; subscriptions, mounts and frames are separate.', url: 'https://www.starlink.com/boats' },
    { pattern: /\b(?:Caframo|Sirocco|Bora)\b/i, model: 'Caframo fan', note: 'Confirm original versus II, voltage and quantity; combined Sirocco/Bora rows need separate unit counts.', url: 'https://seekr.caframobrands.com/' },
    { pattern: /\b(?:Weber\s*Q\s*2000|Samsung\s*WW90TA046)\b/i, model: 'Appliance', note: 'Confirm complete model suffix and region. Current successor models are not the same product.' },
    { pattern: /\b(?:Rocna|UFS13|Ocean\s*Craft|OC330|GND\s*10|EPIRB1|Transocean)\b/i, model: 'Marine equipment', note: 'Identifiable product family, but a verified price for the exact size/configuration is still required.' }
  ];

  function toUSD(amount, currency) {
    const rate = fx.perUSD[currency];
    if (!rate) throw new Error(`Unsupported currency: ${currency}`);
    if (!Number.isFinite(amount) || amount < 0) throw new Error('Price must be a non-negative number.');
    return Math.round(amount / rate * 100) / 100;
  }

  function currencyOf(text, fallback = 'USD') {
    const code = String(text).match(/\b(USD|NZD|AUD|GBP|EUR|CAD)\b/i);
    if (code) return code[1].toUpperCase();
    if (/NZ\s?\$/i.test(text)) return 'NZD';
    if (/AU?\s?\$/i.test(text)) return 'AUD';
    if (/CA?\s?\$/i.test(text)) return 'CAD';
    if (/US\s?\$/i.test(text)) return 'USD';
    if (/£/.test(text)) return 'GBP';
    if (/€/.test(text)) return 'EUR';
    return fallback;
  }

  function matchingReferences(name) {
    return references.filter(ref => ref.pattern.test(name) && (!ref.requires || ref.requires.test(name)));
  }

  function lookup(name) {
    const matches = matchingReferences(name);
    if (matches.length !== 1 || matches[0].reviewOnly || /\b(used|second[- ]hand)\b/i.test(name)) return null;
    // A bundled line cannot safely be valued as one unit of one component.
    if (/\b(chain|rode|swivel|plus|with|and|outboard|Yamaha|Tohatsu|Sunpower|frame|cover|cable|bracket|adapter|spares?)\b|[&+;]|\b\d+\s*m\b|\bAIS\s*MOB\b|\bOcean\s*Safety\b/i.test(name)) return null;
    const ref = matches[0];
    if (name.match(new RegExp(ref.pattern.source, 'gi')).length !== 1) return null;
    const quantityMatch = name.match(/^\s*(\d+)\s*x\b/i)
      || name.match(/\b(\d+)\s*(?:Garmin|Fortress|Johnson|Volvo|Ocean Signal|Victron|SmartSolar|MPPT|Highfield)\b/i)
      || name.match(/\b(?:qty|quantity)\s*[:=]?\s*(\d+)\b/i)
      || name.match(/\bx\s*(\d+)\b/i)
      || name.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s*(?=Victron|SmartSolar|MPPT|\d+\s*\/)/i);
    const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
    const quantity = quantityMatch ? (words[quantityMatch[1].toLowerCase()] || Number(quantityMatch[1])) : 1;
    if (!quantity || quantity > 1000) return null;
    return {
      status: 'estimate', model: ref.model, amount: ref.amount, currency: ref.currency,
      quantity, usd: Math.round(ref.amount * quantity * (ref.fxRate ?? 1 / fx.perUSD[ref.currency]) * 100) / 100, url: ref.url,
      note: ref.note || '', checkedDate: ref.checkedDate || checkedDate,
      fxDate: ref.fxDate || fx.date, fxRate: ref.fxRate ?? 1 / fx.perUSD[ref.currency], fxSource: ref.fxSource || fx.source
    };
  }

  function research(name) {
    if (!name || /\b(used|second[- ]hand)\b/i.test(name)) return null;
    const components = matchingReferences(name).map(ref => ({
      model: ref.model, amount: ref.amount, currency: ref.currency,
      usd: Math.round(ref.amount * (ref.fxRate ?? 1 / fx.perUSD[ref.currency]) * 100) / 100,
      url: ref.url, note: ref.note || '', checkedDate: ref.checkedDate || checkedDate,
      fxDate: ref.fxDate || fx.date, fxSource: ref.fxSource || fx.source
    }));
    const notes = researchNotes.filter(ref => ref.pattern.test(name));
    if (!components.length && !notes.length) return null;
    return {
      components,
      notes: notes.map(ref => ({ model: ref.model, note: ref.note, url: ref.url })),
      explanation: components.length
        ? 'Component reference prices only (per unit). Bundle contents, quantity or specification need review; not included in this row total.'
        : 'Research needs a supplier quote or more specification; no price has been invented.'
    };
  }

  function quote(amount, currency, url) {
    let source;
    try { source = new URL(url); } catch { throw new Error('Enter an http(s) price source URL.'); }
    if (!['http:', 'https:'].includes(source.protocol)) throw new Error('Enter an http(s) price source URL.');
    return {
      status: 'estimate', model: 'User researched quote', amount, currency, quantity: 1,
      usd: toUSD(amount, currency), url, checkedDate: new Date().toISOString().slice(0, 10),
      fxDate: fx.date, fxRate: 1 / fx.perUSD[currency], fxSource: fx.source
    };
  }

  function useCatalogue(catalogue) {
    if (!Array.isArray(catalogue.references) || !catalogue.references.length) throw new Error('Price database returned no products.');
    const loaded = catalogue.references.map(ref => {
      if (!ref.model || !(ref.amount > 0) || !fx.perUSD[ref.currency] || !/^https?:\/\//i.test(ref.url)
        || !(ref.fxRate > 0) || !ref.checkedDate || !ref.fxDate || !ref.pattern) {
        throw new Error('Price database returned an invalid price reference.');
      }
      return { ...ref, pattern: new RegExp(ref.pattern, ref.flags || 'i'),
        requires: ref.requires ? new RegExp(ref.requires, ref.requiresFlags || 'i') : undefined };
    });
    references.splice(0, references.length, ...loaded);
  }

  root.EQUIPMENT_PRICING = { fx, checkedDate, references, researchNotes, toUSD, currencyOf, lookup, research, quote, useCatalogue };
})(typeof window === 'undefined' ? globalThis : window);
