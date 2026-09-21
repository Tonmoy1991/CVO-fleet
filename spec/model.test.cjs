// Node harness: exercises the data model & filter logic without a browser.
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../src/scripts/app.js', 'utf8').replace("document.addEventListener('DOMContentLoaded', boot);", '');
const csvText = fs.readFileSync(__dirname + '/../data/TonmoyTest_2026_09_18.csv', 'utf8');
const gaz = fs.readFileSync(__dirname + '/../data/cloud_region_gazetteer.json', 'utf8');

const anything = () => new Proxy(function () { }, { get: (t, p) => p === Symbol.toPrimitive ? () => '' : (p === 'then' ? undefined : anything()), apply: () => anything() });
const el = () => ({ textContent: '', innerHTML: '', style: { setProperty() { } }, open: false, click() { }, href: '', download: '', dataset: {}, classList: { add() { }, remove() { }, toggle() { return false; }, contains() { return true; } }, addEventListener() { }, setAttribute() { }, getAttribute() { }, appendChild() { }, querySelector: () => el(), querySelectorAll: () => [], getBoundingClientRect: () => ({ width: 1400, height: 900 }), getContext: () => anything(), focus() { }, remove() { }, insertBefore() { }, insertAdjacentHTML() { }, closest() { return null; }, children: [] });
global.document = { querySelector: (s) => s === '#cvo-gazetteer' ? { textContent: gaz } : el(), querySelectorAll: () => [], addEventListener() { }, createElement: () => el(), body: el(), documentElement: el() };
global.window = { addEventListener() { } }; global.location = { hash: '' }; global.history = { replaceState() { } };
global.getComputedStyle = () => ({ getPropertyValue: (n) => ({ '--ok': '#00D3A7', '--warn': '#F59E0B', '--crit': '#EF4444', '--accent': '#00D3A7', '--accent-2': '#3B82F6' }[n] || '#000') });
global.requestAnimationFrame = (f) => 0; global.cancelAnimationFrame = () => {}; global.performance = { now: () => 0 }; global.innerWidth = 1400; global.innerHeight = 900; global.devicePixelRatio = 1;
const d3 = anything();
const real0 = {
  rollup: (arr, red, key) => { const m = new Map(); for (const a of arr) { const k = key(a); (m.get(k) || m.set(k, []).get(k)).push(a); } for (const [k, v] of m) m.set(k, red(v)); return m; },
  group: (arr, key) => { const m = new Map(); for (const a of arr) { const k = key(a); (m.get(k) || m.set(k, []).get(k)).push(a); } return m; },
  sum: (arr, f = x => x) => arr.reduce((s, x) => s + (+f(x) || 0), 0),
  median: (arr, f = x => x) => { const v = arr.map(f).filter(x => x != null && isFinite(x)).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : undefined; },
  extent: (arr, f = x => x) => [Math.min(...arr.map(f)), Math.max(...arr.map(f))],
  greatest: (it, f) => { let best; for (const x of it) if (best === undefined || f(x) > f(best)) best = x; return best; },
  format: (spec) => (x) => spec.includes('%') ? Math.round(x * 100) + '%' : String(Math.round(x * 100) / 100),
  scaleOrdinal: () => (x) => '#888', interpolateRgbBasis: () => (t) => '#888', interpolateNumber: (a, b) => (t) => a + (b - a) * t,
  zoomIdentity: { k: 1, x: 0, y: 0, apply: (p) => p, invert: (p) => p, translate() { return this; }, scale() { return this; } }
};
global.d3 = new Proxy(d3, { get: (t, p) => p in real0 ? real0[p] : d3[p] });
global.topojson = undefined; global.fetch = () => Promise.reject(new Error('offline'));

global.csvText = csvText; global.real = real0;
const vm = require('vm');
const ctx = vm.createContext(global);
vm.runInContext(src + `
;(function(){
  const { columns, rows } = parseCSV(csvText);
  console.log('parsed', columns.length, 'cols', rows.length, 'rows');
  M = buildModel(columns, rows);
  console.log('connectors', M.connectors.size, 'cvos', M.cvos.length, 'customers', M.customers.size, 'latest', M.latest && M.latest.label);
  const st = stats(M.cvos, [...M.connectors.values()]);
  console.log('stats', JSON.stringify(st));
  const unmatched = M.report.filter(r => !r.header).map(r => r.field); console.log('unmapped fields', unmatched);
  const fuzzy = M.report.filter(r => r.how === 'fuzzy').map(r => r.field + '->' + r.header); console.log('fuzzy', fuzzy);
  const noloc = [...M.connectors.values()].filter(c => !c.loc); console.log('connectors without loc', noloc.length, 'by provider', JSON.stringify([...real.rollup(noloc, v => v.length, c => c.provider)]));
  console.log('geo', JSON.stringify([...real.rollup([...M.connectors.values()], v => v.length, c => c.geo)]));
  console.log('health', JSON.stringify([...real.rollup(M.cvos, v => v.length, c => c.health)]));
  console.log('drift', M.cvos.filter(c => c.drift).length, 'util>85', M.cvos.filter(c => c.util > .85).length, 'util null', M.cvos.filter(c => c.util == null).length);
  // filter test
  state.filters.customers = new Set(['Ove Arup AND Partners']);
  const s = selection(); console.log('Arup', s.cvos.length, s.connectors.length, JSON.stringify(stats(s.cvos, s.connectors)));
  state.filters.providers = new Set(['azure']); const s2 = selection(); console.log('Arup+azure', s2.cvos.length, s2.connectors.length);
  Object.values(state.filters).forEach(x => x.clear());
  for (const d of FILTER_DEFS) { const vals = new Set(); for (const c of M.cvos) for (const v of d.of(c, M.connectors.get(c.connectorId))) if (v) vals.add(v); console.log(d.key, vals.size); }
  // detail sanity for a few
  const c = M.cvos.find(x => x.util != null && x.capGb); console.log('sample', c.name, c.capGb, c.usedGb, c.util, c.ontapRaw, c.ontap && c.ontap.family, c.country, c.health);
  const on = M.cvos.find(x => x.type === 'ON_PREM'); console.log('onprem sample', on.name, on.provider, on.country, on.status, on.util);
})();
`, ctx);

// ---- smoke-run the UI code paths with DOM stubs
const dataJSON = JSON.stringify((() => { const { columns, rows } = (function(){ const s = csvText; const r = []; let row=[],f='',q=false; for (let i=0;i<s.length;i++){const c=s[i]; if(q){ if(c==='"'){ if(s[i+1]==='"'){f+='"';i++;} else q=false;} else f+=c;} else if(c==='"') q=true; else if(c===','){row.push(f);f='';} else if(c==='\n'||c==='\r'){ if(c==='\r'&&s[i+1]==='\n') i++; row.push(f); r.push(row); row=[]; f='';} else f+=c;} if(f!==''||row.length){row.push(f);r.push(row);} const h=r.shift(); return {columns:h, rows:r.filter(x=>x.length>1)}; })(); return { columns, rows }; })());
global.document.querySelector = (s) => s === '#cvo-gazetteer' ? { textContent: gaz } : s === '#cvo-data' ? { textContent: dataJSON } : el();
vm.runInContext(`
;(function(){
  try {
    boot(); console.log('boot ok');
    const con = [...M.connectors.values()].filter(c => c.loc).sort((a,b)=>b.cvos.length-a.cvos.length)[0];
    state.connectorId = con.id; state.customer = con.customer;
    Graph.show('connector'); console.log('graph connector ok', con.name, con.cvos.length);
    Graph.show('customer'); console.log('graph customer ok', con.customer);
    state.customer = 'NetApp'; Graph.show('customer'); console.log('graph NetApp ok');
    const cv = con.cvos[0]; state.cvoId = cv.id; Detail.show(cv.id); console.log('detail ok', cv.name);
    const on = M.cvos.find(x => x.type === 'ON_PREM' && x.capGb == null) || M.cvos.find(x => x.type === 'ON_PREM'); Detail.show(on.id); console.log('detail onprem ok', on.name);
    const nocap = M.cvos.find(x => x.capGb == null); if (nocap) { Detail.show(nocap.id); console.log('detail nocap ok'); }
    renderCrumbs(); showDataModal(); console.log('modal ok');
    state.filters.customers = new Set(['NetApp']); Fleet.applyFilters(true); console.log('filters ok');
    exportCSV(); console.log('csv ok');
  } catch (e) { console.error('SMOKE FAIL', e); }
})();
`, ctx);
vm.runInContext(`
;(function(){
  try {
    // scenario: deep-link to a customer, then use the multiselect set — must be the same Set object
    const before = state.filters.customers;
    global.location.hash = '#/customer/' + encodeURIComponent('Ove Arup AND Partners'); route();
    console.log('same set after route:', before === state.filters.customers, [...state.filters.customers]);
    state.filters.customers.add('Chevron'); const s = selection(); console.log('Arup+Chevron', s.cvos.length, s.connectors.length);
    console.log(validationTable().replace(/<[^>]+>/g,' ').replace(/\\s+/g,' ').slice(0,600));
  } catch (e) { console.error('SMOKE2 FAIL', e); }
})();
`, ctx);
vm.runInContext(`
;(function(){
  try {
    Object.values(state.filters).forEach(x => x.clear());
    const uk = [...new Set(M.cvos.map(c => c.country))].find(c => /United Kingdom|UK/i.test(c)); console.log('UK label:', uk);
    state.filters.countries.add(uk); let s = selection();
    console.log('UK filter:', s.cvos.length, 'systems,', s.connectors.length, 'connectors; countries in result:', [...new Set(s.cvos.map(c => c.country))], '; connector countries:', [...new Set(s.connectors.map(c => c.loc ? c.loc.country : 'onprem'))]);
    state.filters.customers.add('Ove Arup AND Partners'); s = selection(); console.log('Arup+UK:', s.cvos.length, [...new Set(s.cvos.map(c=>c.country))]);
    Object.values(state.filters).forEach(x => x.clear()); state.filters.providers.add('azure'); s = selection(); console.log('azure only:', s.cvos.length, [...new Set(s.cvos.map(c=>c.provider))]);
    Object.values(state.filters).forEach(x => x.clear()); state.filters.geos.add('APAC'); s = selection(); console.log('APAC:', s.cvos.length, [...new Set(s.cvos.map(c=>c.geo))]);
    Object.values(state.filters).forEach(x => x.clear()); state.filters.statuses.add('FAILED'); s = selection(); console.log('FAILED:', s.cvos.length, [...new Set(s.cvos.map(c=>c.status))]);
    Object.values(state.filters).forEach(x => x.clear());
    console.log('systems w/o location', M.cvos.filter(c=>!c.loc).length, '| located via connector', M.cvos.filter(c=>c.locSource==='connector location').length);
    Fleet.applyFilters(false); console.log('map ok');
  } catch (e) { console.error('SMOKE3 FAIL', e); }
})();
`, ctx);
vm.runInContext(`
;(function(){
  try {
    Object.values(state.filters).forEach(x => x.clear()); state.search = '';
    state.filters.customers.add('Ove Arup AND Partners');
    const d = FILTER_DEFS.find(x => x.key === 'providers'); const counts = new Map();
    for (const c of M.cvos) if (cvoMatchesExcept(c, 'providers')) for (const v of d.of(c)) counts.set(v, (counts.get(v)||0)+1);
    console.log('Arup provider options:', [...counts]);
    const dc = FILTER_DEFS.find(x => x.key === 'countries'); const cc = new Map();
    for (const c of M.cvos) if (cvoMatchesExcept(c, 'countries')) for (const v of dc.of(c)) cc.set(v, (cc.get(v)||0)+1);
    console.log('Arup country options:', [...cc]);
    state.filters.countries.add('UK'); const cs = new Map();
    for (const c of M.cvos) if (cvoMatchesExcept(c, 'statuses')) cs.set(c.status, (cs.get(c.status)||0)+1);
    console.log('Arup+UK status options:', [...cs], '| selection', selection().cvos.length);
    Fleet.applyFilters(true); console.log('cascade ok');
  } catch (e) { console.error('SMOKE4 FAIL', e); }
})();
`, ctx);

// ---- assertions (exit non-zero on regression)
vm.runInContext(`
;(function(){
  const assert = (cond, msg) => { if (!cond) { console.error('ASSERT FAIL: ' + msg); process.exitCode = 1; } else console.log('ok  ' + msg); };
  const clear = () => { Object.values(state.filters).forEach(x => x.clear()); state.search = ''; state.scope = 'all'; };
  clear(); let s = selection(); assert(s.cvos.length === 3690 && s.connectors.length === 1129 && M.customers.size === 549, 'whole estate = 3690 systems / 1129 connectors / 549 customers');
  clear(); state.filters.customers.add('Ove Arup AND Partners'); s = selection(); assert(s.cvos.length === 39 && s.connectors.length === 20, 'Arup = 39 systems / 20 connectors');
  state.filters.providers.add('azure'); s = selection(); assert(s.cvos.length === 37, 'Arup + Azure = 37');
  clear(); state.filters.countries.add('UK'); s = selection(); assert(s.cvos.length === 111 && s.connectors.length === 51 && s.cvos.every(c => c.country === 'UK'), 'UK = 111 systems / 51 connectors, all UK');
  clear(); state.filters.statuses.add('FAILED'); s = selection(); assert(s.cvos.length === 354, 'Status FAILED = 354');
  clear(); state.filters.customers.add('Ove Arup AND Partners'); const counts = new Map(); for (const c of M.cvos) if (cvoMatchesExcept(c, 'providers')) counts.set(c.provider, (counts.get(c.provider)||0)+1);
  assert(counts.size === 2 && counts.get('azure') === 37 && counts.get('onprem') === 2, 'Arup cascading cloud options = Azure 37 / On-prem 2');
  clear(); state.scope = 'cloud'; s = selection(); assert(s.cvos.length === 1759, 'Cloud CVO scope = 1759 systems');
  clear();
})();
`, ctx);
