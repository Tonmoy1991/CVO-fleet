/* =========================================================================
   CVO Fleet — application code
   Zones:  // [THEME]   // [DATA]   // [MAP]   // [GRAPH]
   ========================================================================= */
'use strict';
const BUILD_STAMP = '__BUILD__';

/* ------------------------------------------------------------------ [THEME] */
const THEME = {
  bg: '#0B0E14', surface: '#141922', accent: '#00D3A7', accent2: '#3B82F6',
  warn: '#F59E0B', crit: '#EF4444', text: '#E6EAF2', muted: '#8A93A5',
  provider: { aws: '#FF9900', azure: '#3B82F6', gcp: '#34A853', onprem: '#A78BFA', other: '#8A93A5' },
  cb: { ok: '#0072B2', warn: '#E69F00', crit: '#CC79A7', accent: '#56B4E9' }
};
const cssVar = (n) => getComputedStyle(document.body).getPropertyValue(n).trim();
const healthColor = (h) => h === 'critical' ? cssVar('--crit') : h === 'warning' ? cssVar('--warn') : cssVar('--ok');
const providerColor = (p) => THEME.provider[p] || THEME.provider.other;

/* ------------------------------------------------------------------ utils */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtInt = d3.format(',d');
const capParts = (gb) => { let v = (+gb || 0) / 1024, u = 'TB'; if (v >= 1000) { v /= 1024; u = 'PB'; } if (v >= 1000) { v /= 1024; u = 'EB'; } const f = v >= 100 ? d3.format(',.0f') : v >= 10 ? d3.format(',.1f') : d3.format(',.2f'); return { v: f(v), u }; };
const fmtCap = (gb) => { const p = capParts(gb); return `${p.v} ${p.u}`; };
const fmtTB = fmtCap;
const fmtPct = (x) => (x == null || !isFinite(x)) ? '—' : d3.format('.0%')(x);
const num = (v) => { if (v === '' || v == null || v === 'N/A') return null; const n = +v; return isFinite(n) ? n : null; };
const titleCase = (s) => String(s || '').replace(/\b\w/g, c => c.toUpperCase());
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function parseDate(s) { // dd/mm/yy [hh:mm]
  if (!s) return null; const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/); if (!m) return null;
  const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; return new Date(y, +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0));
}
const fmtDate = (s) => { const d = parseDate(s); return d ? d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : (s || '—'); };
function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), ms); }
function download(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

/* ------------------------------------------------------------------ [DATA] */
const GAZ = JSON.parse($('#cvo-gazetteer').textContent);
// Internal field → candidate header names (fuzzy, case-insensitive, first match wins)
const FIELD_MAP = {
  customer_name: ['customer', 'customer_name', 'account_name', 'company'],
  customer_domain: ['customer_company', 'customer_email_domain', 'domain'],
  connector_id: ['connector_id', 'agent_id', 'occm_id'],
  connector_name: ['connector_name', 'connector', 'occm_name'],
  connector_provider: ['connector_provider', 'connector_cloud', 'connector_occm_deployment', 'cloud_provider'],
  connector_region: ['connector_region', 'connector_occm_region', 'occm_region'],
  connector_version: ['connector_occm_version', 'connector_version', 'occm_version', 'version'],
  connector_deployment: ['connector_occm_deployment', 'deployment_mode'],
  connector_host: ['connector_occm_host', 'host'],
  connector_network: ['connector_network', 'vpc', 'vnet'],
  connector_subnet: ['connector_subnet', 'subnet'],
  connector_account: ['connector_account_id', 'connector_occm_cc_account', 'account_id'],
  connector_first_seen: ['connector_first_seen', 'connector_occm_first_seen', 'created_date'],
  connector_last_seen: ['connector_last_seen', 'connector_occm_last_seen'],
  connector_active: ['connector_is_active_latest_monitoring_day', 'connector_active', 'is_active'],
  connector_status: ['connector_cm_agents_status', 'connector_status', 'status'],
  connector_docker: ['connector_use_docker_infra'],
  cvo_id: ['cvo_identifier', 'cvo_id', 'working_environment_id', 'cvo_we_id'],
  cvo_we_id: ['cvo_we_id', 'we_id'],
  cvo_name: ['cvo_name', 'working_environment_name', 'name'],
  cvo_type: ['cvo_we_type', 'we_type', 'type'],
  cvo_status: ['cvo_status', 'status', 'health'],
  cvo_provider: ['cvo_deployment', 'cvo_cloud_provider', 'cvo_provider'],
  cvo_deployment_type: ['cvo_deployment_type'],
  cvo_region: ['cvo_region', 'region'],
  cvo_instance: ['cvo_instance_type', 'instance_type'],
  cvo_ontap: ['cvo_ontap_version', 'ontap_version'],
  cvo_ha: ['cvo_is_ha', 'is_ha', 'ha'],
  cvo_payment: ['cvo_payment', 'payment'],
  cvo_license: ['cvo_license_type', 'license_type'],
  cvo_package: ['cvo_capacity_license_package', 'capacity_license_package', 'package'],
  cvo_capacity_based: ['cvo_is_capacity_based_license'],
  cvo_capacity_gb: ['cvo_capacity_gb', 'provisioned_gb', 'capacity_gb'],
  cvo_allocated_gb: ['cvo_allocated_capacity_gb', 'allocated_gb'],
  cvo_used_disk_gb: ['cvo_used_capacity_disk_gb', 'used_gb', 'used_capacity_gb'],
  cvo_used_tier_gb: ['cvo_used_capacity_tiering_gb', 'tiering_gb'],
  cvo_raw_gb: ['cvo_raw_capacity_gb', 'raw_gb'],
  cvo_volumes: ['cvo_volumes', 'volume_count', 'volumes'],
  cvo_luns: ['cvo_luns', 'luns'],
  cvo_aggregates: ['cvo_aggregates', 'aggregate_count', 'aggregates'],
  cvo_asup: ['cvo_sends_asup', 'asup'],
  cvo_serial: ['cvo_serial_1', 'serial'],
  cvo_serial2: ['cvo_serial_2'],
  cvo_marketplace: ['cvo_saas_marketplace'],
  cvo_subscription: ['cvo_saas_subscription_id', 'subscription_id'],
  cvo_cluster_uuid: ['cvo_cluster_uuid', 'cluster_uuid'],
  cvo_last_active: ['cvo_last_active', 'last_active'],
  cvo_first_seen: ['cvo_first_seen', 'created_date'],
  cvo_last_seen: ['cvo_last_seen', 'last_seen'],
  cvo_snapshot: ['cvo_snapshot_date', 'snapshot_date']
};
const STATUS_HEALTH = { ON: 'healthy', DEGRADED: 'warning', INITIALIZING: 'warning', UPDATING: 'warning', OFF: 'warning', FAILED: 'critical', FAILED_TO_CREATE: 'critical', NOT_FOUND: 'critical' };

function normRegion(r) {
  r = String(r || '').trim().toLowerCase();
  if (!r || r.startsWith('missing') || r.startsWith('on-prem')) return null;
  return r.replace(/-[a-z]$/, '');
}
function parseOntap(v) { const m = String(v || '').match(/(\d+)\.(\d+)\.(\d+)(?:P(\d+))?/); return m ? { maj: +m[1], min: +m[2], pat: +m[3], p: +(m[4] || 0), family: `${m[1]}.${m[2]}`, label: m[0] } : null; }
function regionOf(lon, lat) { if (lon == null) return 'Other'; if (lon < -30) return 'AMER'; if (lon <= 60) return 'EMEA'; return 'APAC'; }

function buildModel(columns, rows) {
  const lower = columns.map(c => String(c).trim().toLowerCase());
  const idx = {}; const report = [];
  for (const [field, cands] of Object.entries(FIELD_MAP)) {
    let i = -1, how = '';
    for (const c of cands) { i = lower.indexOf(c.toLowerCase()); if (i >= 0) { how = 'exact'; break; } }
    if (i < 0) for (const c of cands) { i = lower.findIndex(h => h.includes(c.toLowerCase())); if (i >= 0) { how = 'fuzzy'; break; } }
    idx[field] = i; report.push({ field, header: i >= 0 ? columns[i] : null, how });
  }
  const get = (row, f) => idx[f] >= 0 ? (row[idx[f]] ?? '') : '';
  const connectors = new Map(); const cvos = []; const customers = new Map();

  rows.forEach((row, ri) => {
    const cid = get(row, 'connector_id') || `unknown-${get(row, 'connector_name') || 'connector'}`;
    const cust = get(row, 'customer_name') || 'Unknown customer';
    let con = connectors.get(cid);
    if (!con) {
      const provRaw = String(get(row, 'connector_provider') || '').toLowerCase();
      const prov = /aws/.test(provRaw) ? 'aws' : /azure/.test(provRaw) ? 'azure' : /gcp|google/.test(provRaw) ? 'gcp' : /prem/.test(provRaw) ? 'onprem' : (provRaw || 'other');
      con = {
        id: cid, name: get(row, 'connector_name') || cid.slice(0, 8), customer: cust, provider: prov,
        regionRaw: get(row, 'connector_region'), region: normRegion(get(row, 'connector_region')),
        version: get(row, 'connector_version'), deployment: get(row, 'connector_deployment') || (prov === 'onprem' ? 'ON_PREM' : ''),
        host: get(row, 'connector_host'), network: get(row, 'connector_network'), subnet: get(row, 'connector_subnet'), account: get(row, 'connector_account'),
        firstSeen: get(row, 'connector_first_seen'), lastSeen: get(row, 'connector_last_seen'),
        active: get(row, 'connector_active') === '1' || /active/i.test(get(row, 'connector_status')), status: get(row, 'connector_status'),
        docker: get(row, 'connector_docker') === '1', cvos: [], loc: null, locSource: null
      };
      connectors.set(cid, con);
    }
    const provRaw = String(get(row, 'cvo_provider') || '').toUpperCase();
    const prov = /AWS/.test(provRaw) ? 'aws' : /AZURE/.test(provRaw) ? 'azure' : /GCP|GOOGLE/.test(provRaw) ? 'gcp' : /PREM/.test(provRaw) ? 'onprem' : 'other';
    const status = String(get(row, 'cvo_status') || 'UNKNOWN').toUpperCase();
    const cap = num(get(row, 'cvo_capacity_gb')), usedD = num(get(row, 'cvo_used_disk_gb')), usedT = num(get(row, 'cvo_used_tier_gb'));
    const used = (usedD == null && usedT == null) ? null : (usedD || 0) + (usedT || 0);
    const util = (cap && used != null) ? Math.min(used / cap, 1.5) : null;
    let health = STATUS_HEALTH[status] || 'warning';
    if (health === 'healthy' && util != null && util > 0.85) health = 'warning';
    const cvo = {
      id: get(row, 'cvo_id') || `${cid}_${ri}`, weId: get(row, 'cvo_we_id'), name: get(row, 'cvo_name') || `CVO ${ri}`, connectorId: cid, customer: cust,
      type: String(get(row, 'cvo_type') || (prov === 'onprem' ? 'ON_PREM' : 'VSA')).toUpperCase(), status, health, provider: prov, deploymentType: get(row, 'cvo_deployment_type'),
      regionRaw: get(row, 'cvo_region'), region: normRegion(get(row, 'cvo_region')), instance: get(row, 'cvo_instance'),
      ontapRaw: get(row, 'cvo_ontap'), ontap: parseOntap(get(row, 'cvo_ontap')),
      ha: get(row, 'cvo_ha') === '1' ? true : get(row, 'cvo_ha') === '0' ? false : null,
      payment: get(row, 'cvo_payment'), license: get(row, 'cvo_license'), pkg: get(row, 'cvo_package'), capBased: get(row, 'cvo_capacity_based') === '1',
      capGb: cap, allocGb: num(get(row, 'cvo_allocated_gb')), usedDiskGb: usedD, usedTierGb: usedT, usedGb: used, rawGb: num(get(row, 'cvo_raw_gb')), util,
      volumes: num(get(row, 'cvo_volumes')), luns: num(get(row, 'cvo_luns')), aggregates: num(get(row, 'cvo_aggregates')), asup: get(row, 'cvo_asup') === '1',
      serial: get(row, 'cvo_serial'), serial2: get(row, 'cvo_serial2'), marketplace: get(row, 'cvo_marketplace') === '1', subscription: get(row, 'cvo_subscription'), clusterUuid: get(row, 'cvo_cluster_uuid'),
      lastActive: get(row, 'cvo_last_active'), firstSeen: get(row, 'cvo_first_seen'), lastSeen: get(row, 'cvo_last_seen'), snapshot: get(row, 'cvo_snapshot'), rowIndex: ri
    };
    cvos.push(cvo); con.cvos.push(cvo);
    if (!customers.has(cust)) customers.set(cust, { name: cust, domain: get(row, 'customer_domain'), connectors: new Set(), cvos: [] });
    const cu = customers.get(cust); cu.connectors.add(cid); cu.cvos.push(cvo);
  });

  // locations
  for (const con of connectors.values()) {
    let key = con.region, src = 'connector region';
    if (!key || !GAZ[key]) {
      const counts = d3.rollup(con.cvos.filter(c => c.region && GAZ[c.region]), v => v.length, c => c.region);
      const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      if (best) { key = best[0]; src = 'managed CVO regions'; } else key = null;
    }
    if (key && GAZ[key]) { const g = GAZ[key]; con.loc = { lat: g.lat, lon: g.lon, city: g.city, country: g.country, key }; con.locSource = src; con.geo = regionOf(g.lon, g.lat); }
    else con.geo = 'On-prem';
    con.health = con.cvos.some(c => c.health === 'critical') ? 'critical' : con.cvos.some(c => c.health === 'warning') ? 'warning' : 'healthy';
    con.capGb = d3.sum(con.cvos, c => c.capGb || 0); con.usedGb = d3.sum(con.cvos, c => c.usedGb || 0);
  }
  for (const c of cvos) {
    const g = c.region && GAZ[c.region]; const con = connectors.get(c.connectorId);
    if (g) { c.loc = { lat: g.lat, lon: g.lon, city: g.city, country: g.country, key: c.region }; c.locSource = 'cvo region'; }
    else if (con.loc) { c.loc = con.loc; c.locSource = 'connector location'; }
    else { c.loc = null; c.locSource = null; }
    c.country = c.loc ? c.loc.country : 'On-premises (no location)'; c.city = c.loc ? c.loc.city : null; c.geo = c.loc ? regionOf(c.loc.lon, c.loc.lat) : 'On-prem';
  }

  // ONTAP latest (GA releases only, ignore codename builds)
  const fams = cvos.filter(c => c.ontap && !/__/.test(c.ontapRaw)).map(c => c.ontap);
  const latest = fams.sort((a, b) => b.maj - a.maj || b.min - a.min || b.pat - a.pat || b.p - a.p)[0] || null;
  for (const c of cvos) c.drift = !!(latest && c.ontap && (c.ontap.maj < latest.maj || (c.ontap.maj === latest.maj && latest.min - c.ontap.min >= 3)));
  return { columns, rows, connectors, cvos, customers, report, latest, idx };
}

function parseCSV(text) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift().map(h => h.replace(/^\ufeff/, ''));
  return { columns: header, rows: rows.filter(r => r.length > 1) };
}

/* ------------------------------------------------------------------ state */
let M; // model
const state = {
  layer: 'fleet', customer: null, connectorId: null, cvoId: null,
  filters: { customers: new Set(), providers: new Set(), regions: new Set(), countries: new Set(), statuses: new Set(), ontap: new Set(), types: new Set(), pkgs: new Set(), geos: new Set() },
  present: false, story: null, landReady: false, scope: 'all', search: ''
};
const FILTER_DEFS = [
  { key: 'providers', label: 'All providers', of: (c) => [c.provider], fmt: (v) => v === 'onprem' ? 'On-prem' : v.toUpperCase() },
  { key: 'countries', label: 'All countries', of: (c) => [c.country], fmt: (v) => v },
  { key: 'regions', label: 'All regions', of: (c) => [c.loc ? c.loc.key : 'on-prem (no cloud region)'], fmt: (v) => v },
  { key: 'statuses', label: 'All statuses', of: (c) => [c.status], fmt: (v) => v },
  { key: 'ontap', label: 'All versions', of: (c) => [c.ontap ? c.ontap.family : 'unknown'], fmt: (v) => v === 'unknown' ? 'Unknown' : 'ONTAP ' + v },
  { key: 'pkgs', label: 'All licences', of: (c) => [c.pkg || 'N/A'], fmt: (v) => v },
  { key: 'geos', label: 'All geos', of: (c) => [c.geo], fmt: (v) => v },
  { key: 'types', label: 'All types', of: (c) => [c.type], fmt: (v) => v, hidden: true }
];
function anyFilterExcept(k) { return Object.entries(state.filters).some(([key, s]) => key !== k && s.size) || !!state.search; }
function anyFilter() { return Object.values(state.filters).some(s => s.size) || !!state.search; }
function inScope(c) { return state.scope === 'all' || c.type === 'VSA'; }
function cvoMatches(c) {
  if (!inScope(c)) return false;
  const con = M.connectors.get(c.connectorId); const f = state.filters;
  if (f.customers.size && !f.customers.has(c.customer)) return false;
  for (const d of FILTER_DEFS) { const s = f[d.key]; if (s.size && !d.of(c, con).some(v => s.has(v))) return false; }
  if (state.search) { const q = state.search; if (!(c.name.toLowerCase().includes(q) || con.name.toLowerCase().includes(q) || (c.regionRaw || '').toLowerCase().includes(q) || (c.city || '').toLowerCase().includes(q) || c.customer.toLowerCase().includes(q))) return false; }
  return true;
}
function cvoMatchesExcept(c, skipKey) {
  if (!inScope(c)) return false;
  const con = M.connectors.get(c.connectorId); const f = state.filters;
  if (skipKey !== 'customers' && f.customers.size && !f.customers.has(c.customer)) return false;
  for (const d of FILTER_DEFS) { if (d.key === skipKey) continue; const s = f[d.key]; if (s.size && !d.of(c, con).some(v => s.has(v))) return false; }
  if (state.search) { const q = state.search; if (!(c.name.toLowerCase().includes(q) || con.name.toLowerCase().includes(q) || (c.regionRaw || '').toLowerCase().includes(q) || (c.city || '').toLowerCase().includes(q) || c.customer.toLowerCase().includes(q))) return false; }
  return true;
}
function connectorMatches(con) { return con.cvos.some(cvoMatches); }
function selection() {
  const cvos = M.cvos.filter(cvoMatches); const conIds = new Set(cvos.map(c => c.connectorId));
  const connectors = [...conIds].map(id => M.connectors.get(id));
  return { cvos, connectors };
}
function stats(cvos, connectors) {
  const cap = d3.sum(cvos, c => c.capGb || 0), used = d3.sum(cvos, c => c.usedGb || 0);
  const countries = new Set(cvos.filter(c => c.loc).map(c => c.loc.country));
  const customers = new Set(cvos.map(c => c.customer));
  return { cvos: cvos.length, connectors: connectors.length, customers: customers.size, countries: countries.size, cap, used, util: cap ? used / cap : null,
    atRisk: cvos.filter(c => c.health !== 'healthy').length, drift: cvos.filter(c => c.drift).length,
    unmapped: cvos.filter(c => !c.loc).length };
}

/* ------------------------------------------------------------------ routing */
function go(hash, replace = false) { if (replace) history.replaceState(null, '', hash); else location.hash = hash; if (replace) route(); }
function route() {
  const h = decodeURIComponent(location.hash || '#/fleet');
  let m;
  if ((m = h.match(/^#\/cvo\/(.+)$/))) { const c = M.cvos.find(x => x.id === m[1]); if (c) { state.cvoId = c.id; state.connectorId = c.connectorId; state.customer = c.customer; return showLayer('cvo'); } }
  if ((m = h.match(/^#\/connector\/(.+)$/))) { const con = M.connectors.get(m[1]); if (con) { state.connectorId = con.id; state.customer = con.customer; state.cvoId = null; return showLayer('graph', { mode: 'connector' }); } }
  if ((m = h.match(/^#\/customer\/(.+)\/graph$/))) { if (M.customers.has(m[1])) { state.customer = m[1]; state.connectorId = null; return showLayer('graph', { mode: 'customer' }); } }
  if ((m = h.match(/^#\/customer\/(.+)$/))) { if (M.customers.has(m[1])) { Object.values(state.filters).forEach(x => x.clear()); state.filters.customers.add(m[1]); state.customer = m[1]; Fleet.refreshMS(); showLayer('fleet'); return Fleet.applyFilters(false); } }
  state.connectorId = null; state.cvoId = null; showLayer('fleet');
}
let currentLayer = null;
async function showLayer(name, opts = {}) {
  const prev = currentLayer; currentLayer = name; state.layer = name;
  const el = $(`#layer-${name}`);
  if (name === 'graph') Graph.show(opts.mode || 'connector');
  if (name === 'cvo') Detail.show(state.cvoId);
  if (prev && prev !== name) {
    const pel = $(`#layer-${prev}`); pel.classList.add('leaving'); await sleep(220); pel.classList.add('hidden'); pel.classList.remove('leaving');
    if (prev === 'graph') Graph.stop();
  }
  el.classList.remove('hidden'); el.classList.add('entering'); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('entering')));
  if (name === 'fleet') { Fleet.resize(); if (anyFilter()) Fleet.fitTo(selection().connectors); else if (prev && prev !== name) Fleet.reset(); }
  if (name === 'graph') Graph.resize();
  renderCrumbs();
}
function renderCrumbs() {
  const c = $('#crumbs'); const parts = [{ label: 'Global Fleet', hash: '#/fleet' }];
  if (state.customer && (state.layer !== 'fleet' || state.filters.customers.size === 1)) parts.push({ label: state.customer, hash: `#/customer/${encodeURIComponent(state.customer)}` });
  if (state.layer === 'graph' && !state.connectorId && state.customer) parts.push({ label: 'Topology', hash: `#/customer/${encodeURIComponent(state.customer)}/graph` });
  if (state.connectorId && state.layer !== 'fleet') { const con = M.connectors.get(state.connectorId); parts.push({ label: con.name, hash: `#/connector/${encodeURIComponent(con.id)}` }); }
  if (state.layer === 'cvo' && state.cvoId) { const cv = M.cvos.find(x => x.id === state.cvoId); parts.push({ label: cv.name, hash: `#/cvo/${encodeURIComponent(cv.id)}` }); }
  c.innerHTML = parts.map((p, i) => `${i ? '<i>/</i>' : ''}<button ${i === parts.length - 1 ? 'aria-current="page"' : ''} data-hash="${esc(p.hash)}" title="${esc(p.label)}">${esc(p.label)}</button>`).join('');
  $$('button', c).forEach(b => b.addEventListener('click', () => go(b.dataset.hash)));
}

/* ------------------------------------------------------------------ [MAP] */
const Fleet = (() => {
  const svg = d3.select('#map'); let W, H, projection, path, gLand, gMarkers, zoom, transform = d3.zoomIdentity, land = null, clusters = [];
  let kpiPrev = {}; let hoverEnabled = true;
  const EXPAND_K = 3.2;

  function init() {
    gLand = svg.append('g').attr('class', 'g-land'); gMarkers = svg.append('g').attr('class', 'g-markers');
    zoom = d3.zoom().scaleExtent([1, 14]).on('zoom', (ev) => { transform = ev.transform; gLand.attr('transform', transform); positionMarkers(); }).on('end', () => { gLand.selectAll('path').attr('stroke-width', 0.5 / transform.k); layoutMarkers(); });
    svg.call(zoom).on('dblclick.zoom', null);
    svg.on('click', (ev) => { if (!ev.target.closest('.marker')) hideClusterList(); });
    resize(); loadLand(); buildControls(); render();
    window.addEventListener('resize', () => { if (state.layer === 'fleet') resize(); });
  }
  function resize() {
    const r = $('#layer-fleet').getBoundingClientRect(); W = r.width || innerWidth; H = r.height || innerHeight;
    svg.attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H);
    projection = d3.geoNaturalEarth1().fitExtent([[20, 70], [W - 20, H - 60]], { type: 'Sphere' });
    path = d3.geoPath(projection); drawLand(); layoutMarkers();
  }
  async function loadLand() {
    try {
      if (typeof topojson === 'undefined') throw new Error('topojson unavailable');
      const r = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json'); const topo = await r.json();
      land = topojson.feature(topo, topo.objects.land); state.landReady = true;
    } catch (e) { land = null; toast('Offline: showing globe grid without coastlines', 4000); }
    drawLand(); $('#map-loading').style.opacity = 0; setTimeout(() => $('#map-loading').remove(), 600);
  }
  function drawLand() {
    gLand.selectAll('*').remove();
    gLand.append('path').attr('class', 'sphere').attr('d', path({ type: 'Sphere' }));
    gLand.append('path').attr('class', 'graticule').attr('d', path(d3.geoGraticule10()));
    if (land) gLand.append('path').attr('class', 'land').attr('d', path(land));
  }
  // cluster connectors by location
  function computeClusters() {
    const cvos = M.cvos.filter(cvoMatches).filter(c => c.loc);
    const byLoc = d3.group(cvos, c => c.loc.key);
    clusters = [...byLoc.entries()].map(([key, list]) => {
      const l = list[0].loc; const [x, y] = projection([l.lon, l.lat]);
      const groups = [...d3.group(list, c => c.connectorId).entries()].map(([cid, cv]) => ({ con: M.connectors.get(cid), cvos: cv })).sort((a, b) => b.cvos.length - a.cvos.length);
      return { key, loc: l, groups, cons: groups.map(g => g.con), x0: x, y0: y, n: list.length };
    });
  }
  function r(count) { return Math.max(6, Math.min(30, 5 + Math.sqrt(count) * 2.8)); }
  function render() {
    computeClusters(); layoutMarkers(); applyFilterStyles();
  }
  // decide items to draw: clusters (collapsed) or individual connectors (expanded on zoom)
  function items() {
    const out = [];
    for (const cl of clusters) {
      const [x, y] = transform.apply([cl.x0, cl.y0]);
      if (x < -120 || x > W + 120 || y < -120 || y > H + 120) continue; // viewport culling
      if (cl.groups.length === 1 || transform.k < EXPAND_K) out.push({ id: 'c:' + cl.key, kind: cl.groups.length === 1 ? 'connector' : 'cluster', x, y, cluster: cl, con: cl.groups.length === 1 ? cl.groups[0].con : null, cvos: cl.groups.length === 1 ? cl.groups[0].cvos : null, count: cl.n, k: cl.groups.length });
      else cl.groups.forEach((g, i) => { const a = i * 2.399963, rad = 14 + 6 * Math.sqrt(i); out.push({ id: 'k:' + g.con.id, kind: 'connector', x: x + Math.cos(a) * rad, y: y + Math.sin(a) * rad, cluster: cl, con: g.con, cvos: g.cvos, count: g.cvos.length, k: 1 }); });
    }
    return out;
  }
  let zoomRaf = null;
  function positionMarkers() { // per-frame: move existing markers only (no re-binding, no label occlusion) — keeps zoom transitions smooth
    if (zoomRaf) return; zoomRaf = requestAnimationFrame(() => {
      zoomRaf = null; const expanded = transform.k >= EXPAND_K;
      gMarkers.selectAll('g.marker').each(function (d) {
        const [x, y] = transform.apply([d.cluster.x0, d.cluster.y0]);
        let nx = x, ny = y; if (d.kind === 'connector' && d.cluster.groups.length > 1 && expanded) { const i = d.cluster.groups.findIndex(g => g.con === d.con); const a = i * 2.399963, rad = 14 + 6 * Math.sqrt(i); nx += Math.cos(a) * rad; ny += Math.sin(a) * rad; }
        this.setAttribute('transform', `translate(${nx},${ny})`);
      });
      const layoutExpanded = lastLayoutK >= EXPAND_K; if (expanded !== layoutExpanded) layoutMarkers(); // cluster expand/collapse threshold crossed
    });
  }
  let lastLayoutK = 1;
  function layoutMarkers() {
    if (!clusters.length) return; lastLayoutK = transform.k;
    const data = items();
    const sel = gMarkers.selectAll('g.marker').data(data, d => d.id);
    sel.exit().remove();
    const ent = sel.enter().append('g').attr('class', 'marker').attr('tabindex', 0).attr('role', 'button');
    ent.append('circle').attr('class', 'halo'); ent.append('circle').attr('class', 'core'); ent.append('text').attr('class', 'count');
    ent.append('circle').attr('class', 'badge-bg'); ent.append('text').attr('class', 'badge');
    ent.append('text').attr('class', 'place'); ent.append('text').attr('class', 'place-sub');
    const all = ent.merge(sel);
    const worst = (d) => { const list = d.kind === 'cluster' ? d.cluster.groups.flatMap(g => g.cvos) : d.cvos; return list.some(c => c.health === 'critical') ? 'crit' : list.some(c => c.health === 'warning') ? 'warn' : ''; };
    const prov = (d) => d.kind === 'cluster' ? dominantProvider(d.cluster.groups.flatMap(g => g.cvos)) : dominantProvider(d.cvos);
    all.attr('transform', d => `translate(${d.x},${d.y})`)
      .attr('class', d => `marker p-${prov(d)} ${worst(d)}`)
      .attr('aria-label', d => d.kind === 'cluster' ? `${d.cluster.loc.city}: ${d.count} systems on ${d.k} connectors` : `${d.con.name} at ${d.cluster.loc.city}: ${d.count} systems`);
    all.select('.core').attr('r', d => r(d.count));
    all.select('.halo').attr('r', d => r(d.count) + 3).style('animation-delay', (d, i) => (i % 7) * 0.45 + 's');
    all.select('.count').text(d => r(d.count) >= 8 ? d.count : '').style('font-size', d => (r(d.count) >= 14 ? 11 : 9) + 'px');
    all.select('.badge-bg').attr('r', d => d.kind === 'cluster' && d.k > 1 ? 8 : 0).attr('cx', d => r(d.count) * 0.85).attr('cy', d => -r(d.count) * 0.85).style('display', d => d.kind === 'cluster' && d.k > 1 ? null : 'none');
    all.select('.badge').text(d => d.kind === 'cluster' && d.k > 1 ? d.k : '').attr('x', d => r(d.count) * 0.85).attr('y', d => -r(d.count) * 0.85);
    // place labels with greedy occlusion (largest first)
    const filtered = anyFilter(), k = transform.k; const boxes = [];
    const ordered = data.slice().sort((a, b) => b.count - a.count);
    for (const d of ordered) {
      const main = d.cluster.loc.city, sub = d.kind === 'cluster' ? `${d.cluster.loc.country} · ${d.cluster.key}` : `${d.con.name} · ${d.cluster.key}`;
      const w = Math.max(main.length, sub.length * 0.8) * 6.6 + 8, h = 30; const x0 = d.x - w / 2, y0 = d.y + r(d.count) + 4;
      const show = (filtered || k >= 1.8 || d.count >= 20 || boxes.length < 14) && !boxes.some(b => x0 < b.x + b.w && x0 + w > b.x && y0 < b.y + b.h && y0 + h > b.y);
      d.showLabel = show; if (show) boxes.push({ x: x0, y: y0, w, h });
    }
    all.select('.place').text(d => d.cluster.loc.city).attr('y', d => r(d.count) + 15).style('display', d => d.showLabel ? null : 'none');
    all.select('.place-sub').text(d => d.kind === 'cluster' ? `${d.cluster.loc.country} · ${d.cluster.key}` : `${d.con.name} · ${d.cluster.key}`).attr('y', d => r(d.count) + 27).style('display', d => d.showLabel ? null : 'none');
    all.on('mouseenter', (ev, d) => { if (hoverEnabled) showTip(ev, d); }).on('mousemove', moveTip).on('mouseleave', hideTip)
      .on('click', (ev, d) => { ev.stopPropagation(); hideTip(); if (d.kind === 'cluster') { if (transform.k < EXPAND_K) zoomTo(d.cluster); showClusterList(d.cluster); } else openConnector(d.con); })
      .on('keydown', (ev, d) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); d.kind === 'cluster' ? showClusterList(d.cluster) : openConnector(d.con); } });
    $('#fleet-title').classList.toggle('dim', filtered || k > 1.6);
  }
  function dominantProvider(list) { return d3.greatest(d3.rollup(list, v => v.length, c => c.provider), d => d[1])?.[0] || 'other'; }
  function applyFilterStyles() { /* non-matching connectors are removed from the map entirely (see computeClusters) */ }
  function zoomTo(cl) { const k = Math.max(EXPAND_K, Math.min(8, transform.k * 2.2)); svg.transition().duration(700).ease(d3.easeCubicOut).call(zoom.transform, d3.zoomIdentity.translate(W / 2 - cl.x0 * k, H / 2 - cl.y0 * k).scale(k)); }
  function fitTo(cons, animate = true) {
    const pts = [...new Set(cons.flatMap(c => c.cvos.filter(cvoMatches).filter(v => v.loc).map(v => v.loc.key)))].map(k => { const g = GAZ[k] || (cons.flatMap(c => c.cvos).find(v => v.loc && v.loc.key === k) || {}).loc; return g ? projection([g.lon, g.lat]) : null; }).filter(Boolean);
    if (!pts.length) return reset(animate);
    const [x0, x1] = d3.extent(pts, p => p[0]), [y0, y1] = d3.extent(pts, p => p[1]);
    const k = Math.min(6, 0.8 / Math.max((x1 - x0) / W || 0.01, (y1 - y0) / H || 0.01), pts.length === 1 ? 4 : 6);
    const t = d3.zoomIdentity.translate(W / 2 - k * (x0 + x1) / 2, H / 2 - k * (y0 + y1) / 2).scale(Math.max(1, k));
    (animate ? svg.transition().duration(900).ease(d3.easeCubicInOut) : svg).call(zoom.transform, t);
  }
  function reset(animate = true) { (animate ? svg.transition().duration(800).ease(d3.easeCubicInOut) : svg).call(zoom.transform, d3.zoomIdentity); }

  // tooltip
  const tip = $('#tooltip');
  function showTip(ev, d) {
    const metric = (v, l) => `<div><b>${v}</b><span>${l}</span></div>`;
    if (d.kind === 'cluster') {
      const cl = d.cluster; const st = stats(cl.groups.flatMap(g => g.cvos), cl.cons);
      tip.innerHTML = `<span class="sub">${esc(cl.key)} · ${esc(cl.loc.country)}</span><strong>${esc(cl.loc.city)}</strong><span>${cl.cons.length} connector${cl.cons.length > 1 ? 's' : ''} · ${st.customers} customer${st.customers > 1 ? 's' : ''} · click to expand</span><div class="tooltip-metrics">${metric(fmtInt(st.cvos), 'Systems here')}${metric(fmtCap(st.cap), 'Allocated')}${metric(fmtPct(st.util), 'Utilization')}${metric(fmtInt(st.atRisk), 'At risk')}</div>`;
    } else {
      const c = d.con; const here = d.cvos || d.cluster.groups.find(g => g.con === c).cvos; const st = stats(here, [c]);
      tip.innerHTML = `<span class="sub">${esc(c.customer)}</span><strong>${esc(c.name)}</strong><span>${esc(c.provider === 'onprem' ? 'On-prem' : c.provider.toUpperCase())} connector v${esc(c.version || '?')} · runs in ${c.loc ? esc(c.loc.city) : 'on-prem'}${c.loc && c.loc.key !== d.cluster.key ? ' · systems shown here run in ' + esc(d.cluster.loc.city) : ''}</span><div class="tooltip-metrics">${metric(`${here.length}${here.length !== c.cvos.length ? ` <small>of ${c.cvos.length}</small>` : ''}`, 'Systems here')}${metric(fmtCap(st.cap), 'Allocated')}${metric(fmtPct(st.util), 'Utilization')}${metric(`<span class="pill ${c.health === 'healthy' ? 'ok' : c.health === 'warning' ? 'warn' : 'crit'}">${c.health}</span>`, 'Health')}</div>`;
    }
    tip.classList.remove('hidden'); moveTip(ev);
  }
  function moveTip(ev) { const x = Math.min(ev.clientX + 14, innerWidth - 270), y = Math.min(ev.clientY + 14, innerHeight - 220); tip.style.left = x + 'px'; tip.style.top = y + 'px'; }
  function hideTip() { tip.classList.add('hidden'); }

  function showClusterList(cl) {
    const el = $('#cluster-list'); const groups = cl.groups; const total = d3.sum(groups, g => g.cvos.length);
    el.innerHTML = `<button class="close" id="cl-close" aria-label="Close">✕</button><div class="eyebrow">${esc(cl.key || 'location')}</div><h3>${esc(cl.loc.city)}, ${esc(cl.loc.country)} <small>· ${total} systems · ${groups.length} connector${groups.length > 1 ? 's' : ''}</small></h3>` +
      groups.map(({ con: c, cvos }) => `<div class="row" data-id="${esc(c.id)}"><span><span class="pill ${c.provider}">${esc(c.provider.toUpperCase())}</span> ${esc(c.name)}<br><small>${esc(c.customer)}${c.loc && c.loc.key !== cl.key ? ' · connector in ' + esc(c.loc.city) : ''}</small></span><span><b>${cvos.length}</b> <small>CVO</small><br><small>${fmtCap(d3.sum(cvos, x => x.capGb || 0))}</small></span></div>`).join('');
    el.classList.remove('hidden');
    $('#cl-close').addEventListener('click', hideClusterList);
    $$('.row', el).forEach(rw => rw.addEventListener('click', () => openConnector(M.connectors.get(rw.dataset.id))));
  }
  function hideClusterList() { $('#cluster-list').classList.add('hidden'); }
  function openConnector(con) { hideClusterList(); go(`#/connector/${encodeURIComponent(con.id)}`); }

  // ---- KPIs / controls
  function renderKPIs(st) {
    const items = [
      { k: 'cvos', l: 'MANAGED SYSTEMS', v: st.cvos, f: fmtInt, accent: true }, { k: 'connectors', l: 'CONNECTORS', v: st.connectors, f: fmtInt }, { k: 'customers', l: 'CUSTOMERS', v: st.customers, f: fmtInt }, { k: 'countries', l: 'COUNTRIES', v: st.countries, f: fmtInt },
      { k: 'cap', l: 'ALLOCATED', v: st.cap, f: (x) => { const p = capParts(x); return p.v + '<small>' + p.u + '</small>'; } }, { k: 'used', l: 'REPORTED USED', v: st.used, f: (x) => { const p = capParts(x); return p.v + '<small>' + p.u + '</small>'; } },
      { k: 'util', l: 'UTILIZATION', v: st.util, f: (x) => d3.format('.1%')(x) }
    ];
    const box = $('#kpis');
    if (!box.children.length) box.innerHTML = items.map(i => `<div class="kpi ${i.accent ? 'accent' : ''}" data-k="${i.k}"><span>${i.l}</span><strong>0</strong><i></i></div>`).join('');
    items.forEach(i => {
      const el = $(`.kpi[data-k="${i.k}"] strong`, box); const from = kpiPrev[i.k] ?? 0; const to = i.v ?? 0;
      if (i.v == null) { el.textContent = '—'; kpiPrev[i.k] = 0; return; }
      d3.select(el).transition().duration(900).ease(d3.easeCubicOut).tween('t', () => { const ip = d3.interpolateNumber(from, to); return (t) => { el.innerHTML = i.f(ip(t)); }; });
      kpiPrev[i.k] = to;
    });
    renderBrief(st);
  }
  function renderBrief(st) {
    const { cvos, connectors } = selection();
    const rep = connectors.slice().sort((a, b) => b.cvos.filter(cvoMatches).length - a.cvos.filter(cvoMatches).length)[0];
    const pct = st.cvos ? st.atRisk / st.cvos : 0;
    $('#brief-body').innerHTML = `<h2>${st.atRisk ? `${fmtInt(st.atRisk)} systems need attention` : 'Fleet posture is nominal'}</h2>
      <p>${fmtInt(st.customers)} customer${st.customers === 1 ? ' is' : 's are'} represented in this view. ${st.atRisk ? `${d3.format('.1%')(pct)} of systems cross a status or capacity rule.` : 'No visible system crosses the status or capacity rules.'}</p>
      <div><span><b>${fmtInt(st.drift)}</b> version drift (3+ releases behind)</span><span><b>${M.latest ? esc(M.latest.label) : '—'}</b> latest observed ONTAP</span><span><b>${fmtInt(st.unmapped)}</b> systems without a location</span><span><b>${fmtInt(cvos.filter(c => c.ha === true).length)}</b> HA pairs</span></div>
      <button id="brief-explore" ${rep ? '' : 'disabled'}>Explore the busiest Connector${rep ? ` · ${esc(rep.name)}` : ''} <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg></button>
      <div class="brief-note">${state.scope === 'cloud' ? 'Scope: Cloud CVO — on-prem ONTAP systems are excluded. Switch to “All managed” to include them.' : 'Scope: all managed systems, including on-prem ONTAP reporting through Connectors.'}</div>`;
    const b = $('#brief-explore'); if (b && rep) b.addEventListener('click', () => go(`#/connector/${encodeURIComponent(rep.id)}`));
  }
  function renderRail(cvos, connectors) {
    const byGeo = d3.rollup(cvos, v => v.length, c => c.geo); const order = ['AMER', 'EMEA', 'APAC', 'On-prem'];
    const total = cvos.length || 1; const cls = { AMER: 'amer', EMEA: 'emea', APAC: 'apac', 'On-prem': 'other' };
    const col = { AMER: 'var(--blue)', EMEA: 'var(--teal)', APAC: 'var(--amber)', 'On-prem': 'var(--onprem)' };
    $('#bottom-rail').innerHTML = `<div class="dist"><div class="distribution-bar">${order.map(g => `<i class="${cls[g]}" style="width:${(byGeo.get(g) || 0) / total * 100}%;background:${col[g]}"></i>`).join('')}</div>
        <div class="dist-labels">${order.map(g => `<span><i style="background:${col[g]}"></i>${g === 'On-prem' ? 'On-prem · no location' : g} <b>${fmtInt(byGeo.get(g) || 0)}</b> <em>systems</em></span>`).join('')}</div></div>
      <div class="legend"><span><i style="background:var(--aws)"></i>AWS</span><span><i style="background:var(--azure)"></i>Azure</span><span><i style="background:var(--gcp)"></i>GCP</span><span><i style="background:var(--onprem)"></i>On-prem</span><span class="sz"><i style="width:5px;height:5px"></i><i style="width:10px;height:10px"></i> size = systems at this location</span></div>`;
    // location chips when a filter is active
    const locs = anyFilter() ? [...d3.rollup(cvos.filter(c => c.loc), v => ({ n: v.length, loc: v[0].loc }), c => c.loc.key)].sort((a, b) => b[1].n - a[1].n) : [];
    const rail = $('#locs-rail'); $('#layer-fleet').classList.toggle('with-locs', locs.length > 0);
    if (!locs.length) { rail.classList.add('hidden'); rail.innerHTML = ''; return; }
    const unm = cvos.filter(c => !c.loc).length;
    rail.classList.remove('hidden');
    rail.innerHTML = `<span>PRESENT IN ${locs.length} LOCATION${locs.length > 1 ? 'S' : ''}</span>` + locs.slice(0, 16).map(([key, v]) => `<button class="loc-chip" data-key="${esc(key)}" title="${esc(v.loc.country)} · ${esc(key)}">${esc(v.loc.city)} <small>${esc(v.loc.country)}</small> <b>${v.n}</b></button>`).join('') + (locs.length > 16 ? `<span class="locs-more">+${locs.length - 16} more</span>` : '') + (unm ? `<button class="loc-chip onprem-chip" data-key="on-prem" title="On-prem systems with no location in the export">On-premises <small>no location</small> <b>${unm}</b></button>` : '');
    $$('.loc-chip', rail).forEach(b => b.addEventListener('click', () => { if (b.dataset.key === 'on-prem') { const el = $('#unmapped'); if (el.onclick) el.onclick(); return; } const cl = clusters.find(c => c.key === b.dataset.key); if (cl) { zoomTo(cl); showClusterList(cl); } }));
  }
  function renderUnmapped(cvos) {
    const un = cvos.filter(c => !c.loc); const el = $('#unmapped');
    if (!un.length) { el.classList.add('hidden'); return; } el.classList.remove('hidden');
    const groups = [...d3.group(un, c => c.connectorId).entries()].map(([cid, cv]) => ({ con: M.connectors.get(cid), cvos: cv })).sort((a, b) => b.cvos.length - a.cvos.length);
    el.innerHTML = `<span class="dot"></span><b>${fmtInt(un.length)}</b> ON-PREM SYSTEMS · ${fmtInt(groups.length)} CONNECTORS · NO LOCATION IN EXPORT`;
    el.onclick = () => showClusterList({ key: 'on-prem', loc: { city: 'On-premises systems', country: 'no map location' }, groups, cons: groups.map(g => g.con) });
  }

  // ---- controls: customer picker + secondary filters + scope + search
  let ms;
  function buildControls() {
    ms = customerPicker($('#ms-customer'), { items: () => [...M.customers.values()].map(c => ({ c, list: c.cvos.filter(x => cvoMatchesExcept(x, 'customers')) })).filter(d => d.list.length || state.filters.customers.has(d.c.name)).sort((a, b) => b.list.length - a.list.length).map(({ c, list }) => ({ value: c.name, label: c.name, meta: `${new Set(list.map(x => x.connectorId)).size} conn · ${list.length} sys` })), selected: () => state.filters.customers, onChange: () => { state.customer = state.filters.customers.size === 1 ? [...state.filters.customers][0] : null; applyFilters(true); } });
    const row = $('#filters-row'); row.innerHTML = '';
    FILTER_DEFS.filter(d => !d.hidden).forEach(d => { const s = document.createElement('select'); s.id = 'f-' + d.key; s.setAttribute('aria-label', d.label); s.addEventListener('change', () => { state.filters[d.key].clear(); if (s.value) state.filters[d.key].add(s.value); applyFilters(true); }); row.appendChild(s); });
    fillFilterOptions();
    $('#btn-clear').addEventListener('click', () => { clearAll(); applyFilters(true); });
    $$('#scope-switch button').forEach(b => b.addEventListener('click', () => { state.scope = b.dataset.scope; $$('#scope-switch button').forEach(x => { const on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-pressed', on); }); fillFilterOptions(); ms.refresh(); applyFilters(true); }));
    let st; $('#f-search').addEventListener('input', (e) => { clearTimeout(st); st = setTimeout(() => { state.search = e.target.value.trim().toLowerCase(); applyFilters(true); }, 180); });
  }
  function clearAll() { Object.values(state.filters).forEach(s => s.clear()); state.search = ''; $('#f-search').value = ''; state.customer = null; ms && ms.refresh(); }
  function fillFilterOptions() {
    FILTER_DEFS.filter(d => !d.hidden).forEach(d => {
      const s = $('#f-' + d.key); if (!s) return; const counts = new Map();
      // cascade: options reflect every OTHER active filter (customer, other dropdowns, search, scope)
      for (const c of M.cvos) if (cvoMatchesExcept(c, d.key)) for (const v of new Set(d.of(c, M.connectors.get(c.connectorId)))) if (v) counts.set(v, (counts.get(v) || 0) + 1);
      const vals = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      const cur = [...state.filters[d.key]][0] || '';
      if (cur && !counts.has(cur)) vals.push([cur, 0]);
      const narrowed = anyFilterExcept(d.key);
      s.innerHTML = `<option value="">${d.label}${narrowed ? ` (${vals.length})` : ''}</option>` + vals.map(([v, n]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(d.fmt(v))} (${n})</option>`).join('');
      s.classList.toggle('active', !!cur);
    });
  }
  function applyFilters(animate = false) {
    const { cvos, connectors } = selection(); const st = stats(cvos, connectors);
    renderKPIs(st); renderRail(cvos, connectors); renderUnmapped(cvos); hideClusterList(); if (clusters.length || projection) render();
    fillFilterOptions(); ms && ms.refresh();
    const clr = $('#btn-clear'); clr.classList.toggle('hidden', !anyFilter()); $('#ctl-count').textContent = anyFilter() ? `${fmtInt(st.cvos)} match` : '';
    if (animate && state.layer === 'fleet') { if (anyFilter()) fitTo(connectors); else reset(); }
    renderCrumbs();
  }
  function setHover(on) { hoverEnabled = on; }
  function exportPNG() {
    const clone = svg.node().cloneNode(true); clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const style = document.createElement('style'); style.textContent = `.land{fill:#182030;stroke:#26314a}.graticule{fill:none;stroke:#1a2232}.sphere{fill:#0d121c}.core{fill:${cssVar('--accent')};stroke:#eefff9}.halo{display:none}.count{fill:#04211B;font:700 10px sans-serif;text-anchor:middle;dominant-baseline:central}.place{fill:#eef3f9;font:700 12px sans-serif;text-anchor:middle}.place-sub{fill:#7d8a9c;font:9px sans-serif;text-anchor:middle}.p-aws .core{fill:${THEME.provider.aws}}.p-azure .core{fill:${THEME.provider.azure}}.p-gcp .core{fill:${THEME.provider.gcp}}.p-onprem .core{fill:${THEME.provider.onprem}}.faded{opacity:.08}.badge{fill:#E6EAF2;font:700 11px sans-serif;text-anchor:middle;dominant-baseline:central}.badge-bg{fill:#0B0E14;stroke:#444}`;
    clone.insertBefore(style, clone.firstChild);
    const xml = new XMLSerializer().serializeToString(clone); const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); c.width = W * 2; c.height = H * 2; const ctx = c.getContext('2d'); ctx.fillStyle = THEME.bg; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height); c.toBlob(b => download('cvo-fleet-map.png', b)); };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
  }
  function flyTo(cl, k = 3.4, ms = 1600) { if (!cl) return; svg.transition().duration(ms).ease(d3.easeCubicInOut).call(zoom.transform, d3.zoomIdentity.translate(W / 2 - cl.x0 * k, H / 2 - cl.y0 * k).scale(k)); }
  function topClusters(n = 6) { return clusters.slice().sort((a, b) => b.n - a.n).slice(0, n).map(cl => ({ cl, key: cl.key, city: cl.loc.city, country: cl.loc.country, n: cl.n, k: cl.groups.length, provider: dominantProvider(cl.groups.flatMap(g => g.cvos)) })); }
  return { init, resize, render, applyFilters, fitTo, reset, fillFilterOptions, setHover, exportPNG, flyTo, topClusters, zoomToConnector: (con) => { const best = d3.greatest(d3.rollup(con.cvos.filter(c => c.loc), v => v.length, c => c.loc.key), d => d[1]); const loc = best ? con.cvos.find(c => c.loc && c.loc.key === best[0]).loc : con.loc; if (loc) { const [x, y] = projection([loc.lon, loc.lat]); const k = 5; svg.transition().duration(1200).ease(d3.easeCubicInOut).call(zoom.transform, d3.zoomIdentity.translate(W / 2 - x * k, H / 2 - y * k).scale(k)); } }, refreshMS: () => ms && ms.refresh(), clearAll };
})();

/* customer picker — details/summary popover with search, select-all and chips */
function customerPicker(root, opts) {
  let q = ''; const SEL = () => opts.selected();
  root.innerHTML = `<details><summary aria-label="Customer filter"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.5 10 19 14 21 14 12.5 22 3"/></svg><b id="cp-label">All customers</b></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></summary>
    <div class="picker-popover"><label><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input type="text" placeholder="Search customers…" aria-label="Search customers"></label>
    <div class="picker-actions"><button data-a="all">Select all</button><span class="cp-count"></span><button data-a="clear">Clear</button></div><div class="customer-chips"></div><div class="customer-options" role="listbox"></div></div></details>`;
  const det = $('details', root), input = $('input', root), list = $('.customer-options', root), chips = $('.customer-chips', root), label = $('#cp-label', root), count = $('.cp-count', root);
  function renderLabel() { const sel = [...SEL()]; label.textContent = sel.length === 0 ? 'All customers' : sel.length === 1 ? sel[0] : `${sel.length} customers`; }
  function renderChips() { const sel = [...SEL()]; chips.innerHTML = sel.map(v => `<span><b>${esc(v)}</b><button aria-label="Remove ${esc(v)}" data-v="${esc(v)}">×</button></span>`).join(''); $$('button', chips).forEach(b => b.addEventListener('click', (e) => { e.preventDefault(); SEL().delete(b.dataset.v); refresh(); opts.onChange(); })); }
  function renderList() {
    const items = opts.items().filter(i => !q || i.label.toLowerCase().includes(q));
    count.textContent = `${items.length} customers`;
    list.innerHTML = items.length ? items.slice(0, 400).map(i => `<button role="option" aria-selected="${SEL().has(i.value)}" class="${SEL().has(i.value) ? 'selected' : ''}" data-v="${esc(i.value)}"><i>${SEL().has(i.value) ? '✓' : ''}</i>${esc(i.label)}<small>${esc(i.meta)}</small></button>`).join('') : '<div class="empty">No customers match</div>';
    $$('button', list).forEach(b => b.addEventListener('click', (e) => { e.preventDefault(); const v = b.dataset.v; SEL().has(v) ? SEL().delete(v) : SEL().add(v); refresh(); opts.onChange(); }));
  }
  function refresh() { renderLabel(); renderChips(); renderList(); }
  $('[data-a=all]', root).addEventListener('click', (e) => { e.preventDefault(); opts.items().filter(i => !q || i.label.toLowerCase().includes(q)).forEach(i => SEL().add(i.value)); refresh(); opts.onChange(); });
  $('[data-a=clear]', root).addEventListener('click', (e) => { e.preventDefault(); SEL().clear(); refresh(); opts.onChange(); });
  input.addEventListener('input', () => { q = input.value.trim().toLowerCase(); renderList(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const first = $('button', list); if (first) first.click(); e.preventDefault(); } if (e.key === 'Escape') { det.open = false; e.stopPropagation(); } });
  det.addEventListener('toggle', () => { if (det.open) { renderList(); setTimeout(() => input.focus(), 30); } });
  document.addEventListener('mousedown', (e) => { if (!root.contains(e.target)) det.open = false; });
  refresh();
  return { refresh, focus: () => { det.open = true; input.focus(); } };
}

/* ------------------------------------------------------------------ [GRAPH] */
const Graph = (() => {
  const canvas = $('#graph'); const ctx = canvas.getContext('2d');
  let W, H, dpr = 1, nodes = [], links = [], sim = null, transform = d3.zoomIdentity, hover = null, focus = null, mode = 'connector', raf = null, zoomB, adjacency = new Map();
  let colorBy = 'health', showLabels = true, showInfra = false, linkDist = 90, running = false;
  const R = { hub: 26, connector: 14, cvo: 5, infra: 9 };

  function init() {
    zoomB = d3.zoom().scaleExtent([0.15, 8]).filter((ev) => !ev.ctrlKey && !ev.button && !((ev.type === 'mousedown' || ev.type === 'touchstart') && pick(ev.offsetX, ev.offsetY))).on('zoom', (ev) => { transform = ev.transform; draw(); });
    d3.select(canvas).call(zoomB).on('dblclick.zoom', null)
      .call(d3.drag().container(canvas).subject((ev) => pick(ev.x, ev.y)).on('start', dragStart).on('drag', dragging).on('end', dragEnd));
    canvas.addEventListener('mousemove', (ev) => { const n = pick(ev.offsetX, ev.offsetY); if (n !== hover) { hover = n; draw(); } showTip(n, ev); });
    canvas.addEventListener('mouseleave', () => { hover = null; hideTip(); draw(); });
    canvas.addEventListener('click', (ev) => { const n = pick(ev.offsetX, ev.offsetY); if (n) activate(n); });
    canvas.addEventListener('dblclick', () => recenter());
    $('#g-color').addEventListener('change', (e) => { colorBy = e.target.value; legend(); draw(); });
    $('#g-labels').addEventListener('click', (e) => { showLabels = !showLabels; e.currentTarget.classList.toggle('active', showLabels); e.currentTarget.setAttribute('aria-pressed', showLabels); draw(); });
    $('#g-infra').addEventListener('click', (e) => { showInfra = !showInfra; e.currentTarget.classList.toggle('active', showInfra); e.currentTarget.setAttribute('aria-pressed', showInfra); build(); });
    $('#g-dist').addEventListener('input', (e) => { linkDist = +e.target.value; build(); });
    $('#g-search').addEventListener('input', (e) => { const q = e.target.value.trim().toLowerCase(); focus = q ? nodes.find(n => n.label.toLowerCase().includes(q)) || null : null; if (focus) panTo(focus); draw(); });
    window.addEventListener('resize', () => { if (state.layer === 'graph') resize(); });
  }
  function resize() { const r = $('.graph-stage').getBoundingClientRect(); const nW = r.width || (innerWidth - 358), nH = r.height || (innerHeight - 72); const changed = nW !== W || nH !== H; W = nW; H = nH; dpr = Math.min(2, devicePixelRatio || 1); canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + 'px'; canvas.style.height = H + 'px'; if (nodes.length) { if (changed) fit(false); draw(); } }
  function dist(l) { const t = l.kind; return t === 'cvo' ? linkDist : t === 'infra' ? linkDist * 1.4 : linkDist * 1.8; }

  function show(m) { resize(); mode = m; hover = null; focus = null; $('#g-search').value = ''; build(); panel(); legend(); startOrbit(); }
  function stop() { running = false; if (sim) sim.stop(); }

  // Static radial layout — deterministic, evenly spaced, no physics.
  function build() {
    nodes = []; links = []; adjacency = new Map();
    const add = (n) => { nodes.push(n); adjacency.set(n.id, new Set()); return n; };
    const link = (a, b, kind, w = 1) => { links.push({ source: a, target: b, kind, w }); adjacency.get(a.id).add(b.id); adjacency.get(b.id).add(a.id); };
    const sp = linkDist / 90; // spacing multiplier from the slider
    const polar = (cx, cy, r, a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    const cx = 0, cy = 0;
    const provLabel = (p) => p === 'onprem' ? 'On-premises' : p.toUpperCase();
    if (mode === 'connector') {
      const con = M.connectors.get(state.connectorId); if (!con) return;
      const hub = add({ id: 'con:' + con.id, type: 'connector', label: con.name, ref: con, r: R.hub, x: cx, y: cy, hub: true });
      const cvos = (anyFilter() ? con.cvos.filter(cvoMatches) : con.cvos).slice().sort((a, b) => (b.capGb || 0) - (a.capGb || 0));
      const n = cvos.length;
      // ring radius grows with count so labels never collide; alternate two rings when dense
      const ring = Math.max(170, n * 78 / (2 * Math.PI)) * sp; const twoRings = n > 18;
      cvos.forEach((c, i) => {
        const a = -Math.PI / 2 + (i / Math.max(n, 1)) * Math.PI * 2 + (n === 1 ? Math.PI / 2 : 0);
        const rr = twoRings && i % 2 ? ring + 95 * sp : ring; const [x, y] = polar(cx, cy, rr, a);
        const nd = add({ id: 'cvo:' + c.id, type: 'cvo', label: c.name, ref: c, r: cvoR(c), x, y, angle: a }); link(hub, nd, 'cvo', 0.8 + (c.util || 0) * 3);
      });
      if (showInfra) {
        const ctxNodes = [{ id: 'cust:' + con.customer, type: 'customer', label: con.customer, ref: M.customers.get(con.customer), r: R.infra + 4 }, { id: 'prov:' + con.provider, type: 'provider', label: provLabel(con.provider), ref: con.provider, r: R.infra }];
        if (con.loc) ctxNodes.push({ id: 'reg:' + con.loc.key, type: 'region', label: `${con.loc.key} · ${con.loc.city}`, ref: con.loc, r: R.infra });
        const extra = new Map();
        for (const c of cvos) { if (c.region && c.region !== (con.loc && con.loc.key) && !extra.has('reg:' + c.region)) { const g = GAZ[c.region]; extra.set('reg:' + c.region, { id: 'reg:' + c.region, type: 'region', label: `${c.region}${g ? ' · ' + g.city : ''}`, ref: g ? { ...g, key: c.region } : null, r: R.infra, cvos: [] }); } if (extra.has('reg:' + c.region)) extra.get('reg:' + c.region).cvos.push(c); if (c.provider !== con.provider && !extra.has('prov:' + c.provider)) extra.set('prov:' + c.provider, { id: 'prov:' + c.provider, type: 'provider', label: provLabel(c.provider), ref: c.provider, r: R.infra, cvos: [] }); if (extra.has('prov:' + c.provider)) extra.get('prov:' + c.provider).cvos.push(c); }
        const outer = (twoRings ? ring + 95 * sp : ring) + 170 * sp;
        // context nodes sit on an outer ring across the top so they read as "context", not as systems
        ctxNodes.forEach((d, i) => { const a = -Math.PI / 2 + (i - (ctxNodes.length - 1) / 2) * 0.55; const [x, y] = polar(cx, cy, outer, a); link(hub, add({ ...d, x, y }), 'infra'); });
        [...extra.values()].forEach((d, i) => { const a = Math.PI / 2 + (i - (extra.size - 1) / 2) * 0.5; const [x, y] = polar(cx, cy, outer, a); const nd = add({ ...d, x, y }); d.cvos.forEach(c => { const cn = nodes.find(x => x.id === 'cvo:' + c.id); if (cn) link(cn, nd, 'infra'); }); });
      }
    } else {
      const cu = M.customers.get(state.customer); if (!cu) return;
      const hub = add({ id: 'cust:' + cu.name, type: 'customer', label: cu.name, ref: cu, r: R.hub, x: cx, y: cy, hub: true });
      const cons = [...cu.connectors].map(id => M.connectors.get(id)).map(con => ({ con, cvos: con.cvos.filter(cvoMatches).slice().sort((a, b) => (b.capGb || 0) - (a.capGb || 0)) })).filter(d => d.cvos.length).sort((a, b) => b.cvos.length - a.cvos.length);
      const total = d3.sum(cons, d => d.cvos.length + 1.6);
      const r2 = Math.max(cons.length * 120 / (2 * Math.PI) + 260, total * 46 / (2 * Math.PI)) * sp; // CVO ring
      const r1 = Math.max(180, r2 - 210 * sp); // connector ring
      const provNodes = new Map(), regNodes = new Map();
      let a0 = -Math.PI / 2;
      cons.forEach(({ con, cvos }) => {
        const sector = (cvos.length + 1.6) / total * Math.PI * 2; const mid = a0 + sector / 2;
        const [x, y] = polar(cx, cy, r1, mid);
        const cn = add({ id: 'con:' + con.id, type: 'connector', label: con.name, ref: con, r: R.connector + Math.min(10, Math.sqrt(con.cvos.length) * 1.5), x, y, angle: mid });
        link(hub, cn, 'hub');
        const m = cvos.length;
        cvos.forEach((c, j) => { const a = m === 1 ? mid : a0 + sector * (0.15 + 0.7 * j / (m - 1)); const rr = m > 10 && j % 2 ? r2 + 90 * sp : r2; const [px, py] = polar(cx, cy, rr, a); const nd = add({ id: 'cvo:' + c.id, type: 'cvo', label: c.name, ref: c, r: cvoR(c), x: px, y: py, angle: a }); link(cn, nd, 'cvo', 0.8 + (c.util || 0) * 3); });
        if (showInfra) {
          if (!provNodes.has(con.provider)) provNodes.set(con.provider, { id: 'prov:' + con.provider, type: 'provider', label: provLabel(con.provider), ref: con.provider, r: R.infra + 3, cons: [] }); provNodes.get(con.provider).cons.push(cn);
          if (con.loc) { if (!regNodes.has(con.loc.key)) regNodes.set(con.loc.key, { id: 'reg:' + con.loc.key, type: 'region', label: `${con.loc.key} · ${con.loc.city}`, ref: con.loc, r: R.infra, cons: [] }); regNodes.get(con.loc.key).cons.push(cn); }
        }
        a0 += sector;
      });
      if (showInfra) {
        // providers on a small inner ring, regions on the far outer ring at the mean angle of their connectors
        [...provNodes.values()].forEach((d, i, arr) => { const a = -Math.PI / 2 + i / arr.length * Math.PI * 2; const [x, y] = polar(cx, cy, 95 * sp, a); const nd = add({ ...d, x, y }); d.cons.forEach(cn => link(cn, nd, 'infra')); });
        const rOut = r2 + 190 * sp;
        [...regNodes.values()].forEach((d) => { const ang = Math.atan2(d3.mean(d.cons, c => Math.sin(c.angle)), d3.mean(d.cons, c => Math.cos(c.angle))); const [x, y] = polar(cx, cy, rOut, ang); const nd = add({ ...d, x, y }); d.cons.forEach(cn => link(cn, nd, 'infra')); });
      }
    }
    if (sim) { sim.stop(); sim = null; }
    fit(false); draw();
  }
  function bounds() { const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y); return { x0: Math.min(...xs) - 90, x1: Math.max(...xs) + 90, y0: Math.min(...ys) - 60, y1: Math.max(...ys) + 70 }; }
  function fit(animate = true) {
    if (!nodes.length) return; const b = bounds(); const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    const pad = 0.86; const k = Math.max(0.15, Math.min(2.2, pad * Math.min(W / bw, (H - 120) / bh)));
    const t = d3.zoomIdentity.translate(W / 2 - k * (b.x0 + b.x1) / 2, H / 2 + 30 - k * (b.y0 + b.y1) / 2).scale(k);
    (animate ? d3.select(canvas).transition().duration(600) : d3.select(canvas)).call(zoomB.transform, t);
  }
  function cvoR(c) { const tb = (c.capGb || 0) / 1024; return R.cvo + Math.min(14, Math.sqrt(tb) * 1.6); }

  function nodeColor(n) {
    if (n.type === 'connector') return n.hub ? cssVar('--accent') : cssVar('--accent-2');
    if (n.type === 'customer') return '#e8edf5';
    if (n.type === 'provider') return providerColor(n.ref);
    if (n.type === 'region') return '#8A93A5';
    const c = n.ref;
    switch (colorBy) {
      case 'type': return c.type === 'VSA' ? cssVar('--accent') : THEME.provider.onprem;
      case 'provider': return providerColor(c.provider);
      case 'ontap': return ontapScale(c.ontap ? c.ontap.family : null);
      case 'license': return licScale(c.pkg || 'N/A');
      case 'ha': return c.ha === true ? cssVar('--accent-2') : c.ha === false ? cssVar('--warn') : '#5B6478';
      default: return healthColor(c.health);
    }
  }
  const ontapScale = (f) => { if (!f) return '#5B6478'; const fams = [...new Set(M.cvos.filter(c => c.ontap).map(c => c.ontap.family))].sort((a, b) => parseFloat(a) - parseFloat(b)); const i = fams.indexOf(f) / Math.max(1, fams.length - 1); return d3.interpolateRgbBasis(['#7f1d1d', '#F59E0B', '#00D3A7'])(i); };
  const licScale = d3.scaleOrdinal(['#00D3A7', '#3B82F6', '#F59E0B', '#A78BFA', '#EC4899', '#8A93A5']);
  function legend() {
    let items = [];
    if (colorBy === 'health') items = [['Healthy', healthColor('healthy')], ['Warning / >85% used', healthColor('warning')], ['Critical / failed', healthColor('critical')]];
    else if (colorBy === 'type') items = [['CVO (VSA)', cssVar('--accent')], ['On-prem ONTAP', THEME.provider.onprem]];
    else if (colorBy === 'provider') items = Object.entries(THEME.provider).filter(([k]) => k !== 'other').map(([k, v]) => [k === 'onprem' ? 'On-prem' : k.toUpperCase(), v]);
    else if (colorBy === 'ontap') items = [...new Set(M.cvos.filter(c => c.ontap).map(c => c.ontap.family))].sort((a, b) => parseFloat(a) - parseFloat(b)).map(f => ['ONTAP ' + f, ontapScale(f)]);
    else if (colorBy === 'license') items = [...new Set(M.cvos.map(c => c.pkg || 'N/A'))].map(p => [p, licScale(p)]);
    else items = [['HA pair', cssVar('--accent-2')], ['Single node', cssVar('--warn')], ['Unknown', '#5B6478']];
    items.push(['Connector', cssVar('--accent-2')], ['Region / cloud', '#8A93A5']);
    $('#g-legend').innerHTML = items.map(([l, c]) => `<span><i style="background:${c};box-shadow:0 0 8px ${c}"></i>${esc(l)}</span>`).join('');
  }

  function draw() {
    if (!nodes.length) return;
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.translate(transform.x, transform.y); ctx.scale(transform.k, transform.k);
    const hl = hover || focus; const nb = hl ? adjacency.get(hl.id) : null;
    const dimA = hl ? 0.12 : 1;
    // links
    for (const l of links) {
      const on = !hl || l.source === hl || l.target === hl;
      ctx.beginPath(); ctx.moveTo(l.source.x, l.source.y); ctx.lineTo(l.target.x, l.target.y);
      ctx.lineWidth = (l.kind === 'cvo' ? l.w : 1) / Math.sqrt(transform.k);
      ctx.strokeStyle = l.kind === 'infra' ? `rgba(103,129,151,${on ? .5 : .06})` : `rgba(103,129,151,${on ? (l.kind === 'hub' ? .95 : .7) : .08})`;
      if (l.kind === 'infra') ctx.setLineDash([3, 4]); else ctx.setLineDash([]);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // nodes
    for (const n of nodes) {
      const on = !hl || n === hl || nb.has(n.id); ctx.globalAlpha = on ? 1 : dimA;
      const col = nodeColor(n);
      if (n.hub || n === hl) { ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 10, 0, Math.PI * 2); ctx.fillStyle = col; ctx.globalAlpha = (on ? 1 : dimA) * 0.15; ctx.fill(); ctx.globalAlpha = on ? 1 : dimA; }
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
      if (n.type === 'cvo' && n.ref.ha) { ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 2.5, 0, Math.PI * 2); ctx.lineWidth = 1.2 / transform.k; ctx.strokeStyle = 'rgba(230,234,242,.6)'; ctx.stroke(); }
      if (n.type === 'region') { ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.strokeStyle = '#E6EAF2'; ctx.lineWidth = 1 / transform.k; ctx.stroke(); }
      if (n === focus) { ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 6, 0, Math.PI * 2); ctx.strokeStyle = cssVar('--accent'); ctx.lineWidth = 2 / transform.k; ctx.stroke(); }
    }
    // labels
    ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const k = transform.k; const cvoLabels = showLabels;
    for (const n of nodes) {
      const on = !hl || n === hl || nb.has(n.id);
      const isBig = n.type !== 'cvo';
      if (!(isBig || cvoLabels || n === hl || (hl && on))) continue;
      if (!showLabels && n !== hl) continue;
      const fs = (isBig ? (n.hub ? 16 : 13) : 12) / Math.max(0.55, Math.sqrt(k));
      ctx.font = `${n.hub ? 700 : 500} ${fs}px ${cssVar('--font') || 'Inter, sans-serif'}`;
      ctx.globalAlpha = on ? 1 : 0.1;
      const txt = n.label.length > 34 ? n.label.slice(0, 32) + '…' : n.label;
      ctx.lineWidth = 3 / k; ctx.strokeStyle = 'rgba(8,11,16,.92)'; ctx.strokeText(txt, n.x, n.y + n.r + 4); ctx.fillStyle = isBig ? '#e8fff9' : '#b9c4d1'; ctx.fillText(txt, n.x, n.y + n.r + 4);
    }
    ctx.restore();
  }
  function pick(x, y) { const [gx, gy] = transform.invert([x, y]); let best = null, bd = 24 / transform.k; for (const n of nodes) { const d = Math.hypot(n.x - gx, n.y - gy) - n.r; if (d < bd) { bd = d; best = n; } } return best; }
  function dragStart(ev) { }
  function dragging(ev) { if (!ev.subject) return; const [gx, gy] = transform.invert([ev.x, ev.y]); ev.subject.x = gx; ev.subject.y = gy; draw(); }
  function dragEnd(ev) { }
  function recenter() { fit(true); }
  function panTo(n) { const k = Math.max(transform.k, 1.6); d3.select(canvas).transition().duration(700).call(zoomB.transform, d3.zoomIdentity.translate(W / 2 - n.x * k, H / 2 - n.y * k).scale(k)); }
  function activate(n) {
    if (n.type === 'cvo') go(`#/cvo/${encodeURIComponent(n.ref.id)}`);
    else if (n.type === 'connector' && !n.hub) go(`#/connector/${encodeURIComponent(n.ref.id)}`);
    else if (n.type === 'customer' && !n.hub) go(`#/customer/${encodeURIComponent(n.ref.name)}/graph`);
    else if (n.type === 'provider') { Fleet.clearAll(); state.filters.providers.add(n.ref); Fleet.refreshMS(); go('#/fleet'); Fleet.applyFilters(true); }
    else if (n.type === 'region' && n.ref && n.ref.key) { Fleet.clearAll(); state.filters.regions.add(n.ref.key); Fleet.refreshMS(); go('#/fleet'); Fleet.applyFilters(true); }
  }
  const tipEl = $('#graph-tip');
  function showTip(n, ev) {
    if (!n) return hideTip();
    const metric = (v, l) => `<div><b>${v}</b><span>${l}</span></div>`; let html = '';
    if (n.type === 'cvo') { const c = n.ref; html = `<span class="sub">${esc(c.type === 'VSA' ? 'Cloud Volumes ONTAP' : 'On-prem ONTAP')} · ${esc(c.regionRaw || '')}</span><strong>${esc(c.name)}</strong><span>ONTAP ${esc(c.ontapRaw || '—')} · ${c.ha === true ? 'HA pair' : c.ha === false ? 'single node' : ''} · click to drill in</span><div class="tooltip-metrics">${metric(`<span class="pill ${c.health === 'healthy' ? 'ok' : c.health === 'warning' ? 'warn' : 'crit'}">${esc(c.status)}</span>`, 'Status')}${metric(esc(c.provider.toUpperCase()), 'Cloud')}${metric(c.capGb != null ? fmtCap(c.capGb) : '—', 'Allocated')}${metric(c.usedGb != null ? fmtPct(c.util) : '—', 'Utilization')}</div>`; }
    else if (n.type === 'connector') { const c = n.ref; html = `<span class="sub">${esc(c.customer)}</span><strong>${esc(c.name)}</strong><span>${esc(c.provider.toUpperCase())} · ${c.loc ? esc(c.loc.city) : 'on-prem'} · v${esc(c.version || '?')}${n.hub ? '' : ' · click to open topology'}</span><div class="tooltip-metrics">${metric(c.cvos.filter(cvoMatches).length, 'Systems')}${metric(fmtCap(c.capGb), 'Allocated')}</div>`; }
    else if (n.type === 'customer') html = `<span class="sub">CUSTOMER</span><strong>${esc(n.label)}</strong><span>${n.ref.connectors.size} connectors · ${n.ref.cvos.length} systems${n.hub ? '' : ' · click for customer topology'}</span>`;
    else if (n.type === 'region') html = `<span class="sub">CLOUD REGION</span><strong>${esc(n.label)}</strong><span>${n.ref && n.ref.country ? esc(n.ref.country) + ' · ' : ''}click to filter the fleet map</span>`;
    else html = `<span class="sub">CLOUD PROVIDER</span><strong>${esc(n.label)}</strong><span>Click to filter the fleet map</span>`;
    tipEl.innerHTML = html; tipEl.classList.remove('hidden'); tipEl.style.left = Math.min(ev.clientX + 14, innerWidth - 270) + 'px'; tipEl.style.top = Math.min(ev.clientY + 14, innerHeight - 200) + 'px';
  }
  function hideTip() { tipEl.classList.add('hidden'); }

  function panel() {
    const p = $('#graph-panel'); const dt = (k, v, sub) => `<div><dt>${k}</dt><dd>${v}${sub ? `<small>${sub}</small>` : ''}</dd></div>`;
    if (mode === 'connector') {
      const con = M.connectors.get(state.connectorId); const shown = con.cvos.filter(cvoMatches); const st = stats(shown, [con]);
      const h = d3.rollup(shown, v => v.length, c => c.health); const hp = con.health === 'healthy' ? '' : con.health;
      p.innerHTML = `<div class="connector-orbit"><span class="orbit-ring"><i class="orbit-dot"></i></span><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg></div>
        <div class="eyebrow">NETAPP CONNECTOR · ${esc(con.provider === 'onprem' ? 'ON-PREMISES' : con.provider.toUpperCase())}</div>
        <h1>${esc(con.name)}</h1>
        <div style="display:flex;gap:6px;flex-wrap:wrap"><span class="status-pill ${hp}"><span></span>${esc(con.health)}</span>${con.active ? '<span class="status-pill"><span></span>active</span>' : ''}</div>
        <div class="mini" style="margin-top:10px" title="Connector ID">${esc(con.id)}</div>
        <dl class="detail-list">
          ${dt('Customer', `<button class="link-btn" id="p-cust">${esc(con.customer)}</button>`)}
          ${dt('Connector runs in', con.loc ? esc(con.loc.city + ', ' + con.loc.country) : 'On-premises')}
          ${dt('Region', esc(con.regionRaw || (con.loc ? con.loc.key : '—')))}
          ${dt('Version', esc(con.version || '—'))}
          ${dt('Deployment', esc(con.deployment || (con.provider === 'onprem' ? 'ON_PREM' : con.provider.toUpperCase())) + (con.docker ? ' · Docker' : ''))}
          ${dt('Account name', esc(con.account || '—'))}
          ${dt('Host name', esc(con.host || '—'))}
          ${dt('Network', esc(con.network || '—'), esc(con.subnet || ''))}
          ${dt('First seen', fmtDate(con.firstSeen))}
          ${dt('Last seen', fmtDate(con.lastSeen))}
        </dl>
        <div class="health-rollup"><div><strong>${shown.length}${shown.length !== con.cvos.length ? `<small style="color:var(--muted);font-size:11px"> / ${con.cvos.length}</small>` : ''}</strong><span>systems${shown.length !== con.cvos.length ? ' (filters applied)' : ' managed'}</span></div><div><strong>${capParts(st.cap).v}<small style="color:var(--muted);font-size:11px"> ${capParts(st.cap).u}</small></strong><span>allocated</span></div><div><strong class="${st.util > .85 ? 'risk-text' : 'healthy-text'}">${fmtPct(st.util)}</strong><span>utilization</span></div><div><strong class="${(h.get('critical') || 0) + (h.get('warning') || 0) ? 'risk-text' : 'healthy-text'}">${(h.get('critical') || 0) + (h.get('warning') || 0)}</strong><span>need attention</span></div></div>
        <div class="health-bar" title="Health roll-up"><i style="width:${(h.get('healthy') || 0) / Math.max(1, shown.length) * 100}%;background:var(--teal)"></i><i style="width:${(h.get('warning') || 0) / Math.max(1, shown.length) * 100}%;background:var(--amber)"></i><i style="width:${(h.get('critical') || 0) / Math.max(1, shown.length) * 100}%;background:var(--red)"></i></div>
        <h3>Managed systems · ${shown.length}</h3>
        <ul class="side-list">${shown.slice().sort((a, b) => (b.capGb || 0) - (a.capGb || 0)).map(c => `<li data-id="${esc(c.id)}"><span><i style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${healthColor(c.health)};margin-right:8px"></i>${esc(c.name)}</span><small>${c.capGb != null ? fmtCap(c.capGb) : esc(c.type)}</small></li>`).join('')}</ul>
        <div class="privacy-note">Relationships are read directly from the export: each system row names the Connector it reports through. Tick “Context” in the toolbar to add customer, cloud and region nodes.</div>`;
      $('#p-cust').addEventListener('click', () => go(`#/customer/${encodeURIComponent(con.customer)}/graph`));
      $$('.side-list li', p).forEach(li => li.addEventListener('click', () => go(`#/cvo/${encodeURIComponent(li.dataset.id)}`)));
    } else {
      const cu = M.customers.get(state.customer); const shown = cu.cvos.filter(cvoMatches); const cons = [...new Set(shown.map(c => c.connectorId))].map(id => M.connectors.get(id)); const st = stats(shown, cons);
      const byProv = d3.rollup(shown, v => v.length, c => c.provider);
      p.innerHTML = `<div class="connector-orbit customer-orbit"><span class="orbit-ring"><i class="orbit-dot"></i></span><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg></div>
        <div class="eyebrow">CUSTOMER TOPOLOGY</div><h1>${esc(cu.name)}</h1>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${[...byProv.entries()].map(([k, v]) => `<span class="pill ${k}">${esc(k === 'onprem' ? 'ON-PREM' : k.toUpperCase())} ${v}</span>`).join('')}</div>
        <div class="health-rollup" style="margin-top:18px"><div><strong>${cons.length}</strong><span>connectors</span></div><div><strong>${shown.length}</strong><span>systems</span></div><div><strong>${capParts(st.cap).v}<small style="color:var(--muted);font-size:11px"> ${capParts(st.cap).u}</small></strong><span>allocated</span></div><div><strong class="${st.util > .85 ? 'risk-text' : 'healthy-text'}">${fmtPct(st.util)}</strong><span>utilization</span></div><div><strong>${st.countries}</strong><span>countries</span></div><div><strong class="${st.atRisk ? 'risk-text' : 'healthy-text'}">${st.atRisk}</strong><span>need attention</span></div></div>
        <button class="link-btn" id="p-map" style="margin-top:14px;padding:8px 10px">Show on fleet map →</button>
        <h3>Connectors · ${cons.length}</h3>
        <ul class="side-list">${cons.slice().sort((a, b) => b.cvos.filter(cvoMatches).length - a.cvos.filter(cvoMatches).length).map(c => `<li data-id="${esc(c.id)}"><span><i style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${providerColor(c.provider)};margin-right:8px"></i>${esc(c.name)}</span><small>${c.cvos.filter(cvoMatches).length} · ${c.loc ? esc(c.loc.city) : 'on-prem'}</small></li>`).join('')}</ul>`;
      $('#p-map').addEventListener('click', () => { go(`#/customer/${encodeURIComponent(cu.name)}`); Fleet.refreshMS(); });
      $$('.side-list li', p).forEach(li => li.addEventListener('click', () => go(`#/connector/${encodeURIComponent(li.dataset.id)}`)));
    }
  }
  let orbitRaf = null;
  function startOrbit() { // rotate the ring with JS so the dot always moves, whatever the OS animation setting
    cancelAnimationFrame(orbitRaf); const ring = $('.connector-panel .orbit-ring'); if (!ring) return; const t0 = performance.now();
    const tick = (t) => { if (!ring.isConnected || state.layer !== 'graph') { orbitRaf = null; return; } ring.style.transform = `rotate(${((t - t0) / 3200 * 360) % 360}deg)`; orbitRaf = requestAnimationFrame(tick); };
    orbitRaf = requestAnimationFrame(tick);
  }
  function exportPNG() { canvas.toBlob(b => download('cvo-topology.png', b)); }
  function focusNode(pred) { const n = nodes.find(pred); if (n) { focus = n; panTo(n); draw(); } return n; }
  function zoomHub(k = 1.8, ms = 1000) { const hub = nodes.find(n => n.hub); if (!hub) return; d3.select(canvas).transition().duration(ms).ease(d3.easeCubicInOut).call(zoomB.transform, d3.zoomIdentity.translate(W / 2 - hub.x * k, H / 2 - hub.y * k).scale(k)); }
  return { init, resize, show, stop, exportPNG, focusNode, zoomHub, fitView: (ms) => { fit(true); }, clearFocus: () => { focus = null; draw(); } };
})();

/* ------------------------------------------------------------------ CVO DETAIL */
const Detail = (() => {
  const ico = {
    ring: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>',
    cfg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2M9 2v2M15 20v2M9 20v2M2 15h2M2 9h2M20 15h2M20 9h2"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.7 9a.6.6 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.6a1 1 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/></svg>',
    bars: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    trend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    info: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>'
  };
  function show(id) {
    const c = M.cvos.find(x => x.id === id); if (!c) return;
    const con = M.connectors.get(c.connectorId); const cu = M.customers.get(c.customer);
    const wrap = $('#cvo-wrap'); $('#layer-cvo').scrollTop = 0;
    const cap = c.capGb, used = c.usedGb, free = cap != null && used != null ? Math.max(0, cap - used) : null;
    const eff = (c.rawGb && c.capGb && c.rawGb > 0) ? c.capGb / c.rawGb : null;
    const peers = cu.cvos.filter(x => x.util != null && inScope(x)); const median = peers.length ? d3.median(peers, x => x.util) : null;
    const fleetPeers = M.cvos.filter(x => x.util != null && inScope(x)); const fleetMed = d3.median(fleetPeers, x => x.util);
    const hp = c.health === 'healthy' ? 'ok' : c.health === 'warning' ? 'warn' : 'crit';
    const insights = [];
    if (c.util != null && c.util > 0.85) insights.push(['crit', `Nearing capacity — ${fmtPct(c.util)} used`]);
    else if (c.util != null && c.util > 0.7) insights.push(['warn', `Watch capacity — ${fmtPct(c.util)} used`]);
    if (c.health === 'critical') insights.push(['crit', `Status ${c.status}`]);
    else if (c.health === 'warning' && STATUS_HEALTH[c.status] === 'warning') insights.push(['warn', `Status ${c.status}`]);
    if (c.drift) insights.push(['warn', `Version drift — ONTAP ${c.ontap.family} is 3+ releases behind ${M.latest ? M.latest.family : 'latest'}`]);
    if (c.type === 'VSA' && c.ha === false) insights.push(['warn', 'Single node — no HA pair']);
    if (!c.asup) insights.push(['warn', 'AutoSupport not sending']);
    if (!con.active) insights.push(['crit', 'Connector inactive on latest monitoring day']);
    if (c.capGb == null) insights.push(['warn', 'No capacity metrics in export']);
    if (c.util != null && median != null && c.util < median - 0.25) insights.push(['ok', `Under-utilised vs customer median ${fmtPct(median)} — right-size candidate`]);
    const level = insights.some(i => i[0] === 'crit') ? 'crit' : insights.some(i => i[0] === 'warn') ? 'warn' : 'ok';
    const ringColor = c.util == null ? 'var(--teal)' : c.util > .85 ? 'var(--red)' : c.util > .7 ? 'var(--amber)' : 'var(--teal)';
    const rawRow = M.rows[c.rowIndex];
    const row = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
    const cmp = (l, v, muted) => `<div class="comparison-row ${muted ? 'muted' : ''}"><span>${l}</span><div><i style="width:${v != null ? Math.min(100, v * 100) : 0}%;${muted ? '' : `background:${ringColor}`}"></i></div><strong>${fmtPct(v)}</strong></div>`;
    wrap.innerHTML = `
      <div class="cvo-hero">
        <div>
          <div class="pills"><span class="pill ${hp}">${esc(c.status)}</span><span class="pill ${c.provider}">${esc(c.provider === 'onprem' ? 'ON-PREM' : c.provider.toUpperCase())}</span><span class="pill neutral">${esc(c.type === 'VSA' ? 'Cloud Volumes ONTAP' : 'On-prem ONTAP')}</span>${c.ha ? '<span class="pill neutral">HA pair</span>' : ''}${c.drift ? '<span class="pill warn">version drift</span>' : ''}</div>
          <h1>${esc(c.name)}</h1>
          <div class="hero-meta"><span>${esc(c.regionRaw || 'no region')}${c.city ? ' · ' + esc(c.city + ', ' + c.country) : ''}</span><span>·</span><span>reports to <button id="d-con">${esc(con.name)}</button></span><span>·</span><button id="d-cust">${esc(c.customer)}</button></div>
        </div>
        <div style="display:flex;gap:12px;align-items:flex-end">
          <div class="signal-card"><span>ONTAP</span><strong>${esc(c.ontapRaw || '—')}</strong></div>
          <div class="pager"><button id="d-prev">‹ Prev</button><span class="pager-pos" id="d-pos"></span><button id="d-next">Next ›</button></div>
        </div>
      </div>

      <div class="insights-strip ${level}"><div class="insight-icon">${level === 'ok' ? ico.check : ico.alert}</div><div><span>INSIGHTS · RULE-BASED</span><strong>${insights.length ? `${insights.length} flag${insights.length > 1 ? 's' : ''} on this system` : 'No flags — healthy, current and within capacity'}</strong>${insights.length ? `<div class="chips">${insights.map(([k, t]) => `<span class="${k}">${esc(t)}</span>`).join('')}</div>` : ''}</div><small>Rules: >85% used · status ≠ ON · 3+ releases behind · single node · AutoSupport off</small></div>

      <div class="detail-grid">
        <div class="detail-card"><div class="card-heading"><h3>CAPACITY</h3>${ico.ring}</div>
          ${cap ? `<div class="capacity-content"><div class="capacity-ring" id="cap-ring" style="--ring:0deg;--ring-color:${ringColor}"><div><strong>${fmtPct(c.util)}</strong><span>USED</span></div></div>
            <div class="capacity-numbers"><div><span>Allocated</span><strong>${fmtCap(cap)}</strong></div><div><span>Reported used</span><strong>${fmtCap(used)}</strong></div><div><span>Free</span><strong>${fmtCap(free)}</strong></div>${c.usedTierGb ? `<div><span>Tiered to object</span><strong>${fmtCap(c.usedTierGb)}</strong></div>` : ''}${c.rawGb ? `<div><span>Raw</span><strong>${fmtCap(c.rawGb)}</strong></div>` : ''}${eff ? `<div><span>Logical : raw</span><strong>${d3.format('.2f')(eff)} : 1</strong></div>` : ''}</div></div>` : `<div class="trend-empty">${ico.info}<div><strong>No capacity metrics for this system</strong><span>The export carries no capacity columns for this row.</span></div></div>`}
        </div>
        <div class="detail-card"><div class="card-heading"><h3>CONFIGURATION</h3>${ico.cfg}</div>
          <dl class="config-grid">
            ${row('ONTAP', esc(c.ontapRaw || '—'))}
            ${row('Deployment', c.type === 'VSA' ? (c.ha === true ? 'HA pair' : c.ha === false ? 'Single node' : '—') : 'On-premises cluster')}
            ${row('Instance', esc(c.instance || '—'))}
            ${row('Licence', esc(c.pkg || '—') + (c.license && c.license !== 'N/A' ? ' · ' + esc(c.license) : '') + (c.payment && c.payment !== 'N/A' ? ' · ' + esc(c.payment) : ''))}
            ${row('Aggregates', c.aggregates ?? '—')}
            ${row('Volumes / LUNs', (c.volumes ?? '—') + ' / ' + (c.luns ?? '—'))}
            ${row('Serial', esc(c.serial || '—') + (c.serial2 ? '<br>' + esc(c.serial2) : ''))}
            ${row('First seen · last active', fmtDate(c.firstSeen) + ' · ' + fmtDate(c.lastActive || c.lastSeen))}
          </dl>
        </div>
      </div>
      <div class="detail-grid">
        <div class="detail-card comparison-card"><div class="card-heading"><h3>PEER COMPARISON · UTILIZATION</h3>${ico.bars}</div>
          ${c.util != null ? `${cmp('This system', c.util)}${cmp(esc(c.customer) + ' median', median, true)}${cmp('Fleet median', fleetMed, true)}<p>Based on ${peers.length} ${esc(c.customer)} systems with capacity metrics · fleet n=${fleetPeers.length} (current scope).</p>` : `<div class="trend-empty">${ico.info}<div><strong>No utilisation metric to compare</strong></div></div>`}
          <div class="card-heading" style="margin-top:22px"><h3>CAPACITY TREND</h3>${ico.trend}</div>
          <div class="trend-empty">${ico.info}<div><strong>Trend data not available in source export</strong><span>Single snapshot (${fmtDate(c.snapshot)}). Provide daily snapshots to enable the sparkline.</span></div></div>
        </div>
        <div class="detail-card"><div class="card-heading"><h3>DATA PROTECTION & TELEMETRY</h3>${ico.shield}</div>
          <div class="protection-state"><div class="${c.asup ? 'healthy-icon' : 'warning-icon'}">${c.asup ? ico.check : ico.alert}</div><div><strong>AutoSupport ${c.asup ? 'sending' : 'not sending'}</strong><span>${c.asup ? 'Proactive telemetry reaches NetApp support' : 'Limited proactive support telemetry'}</span></div></div>
          <div class="protection-state"><div class="${c.ha === true ? 'healthy-icon' : 'warning-icon'}">${c.ha === true ? ico.check : ico.alert}</div><div><strong>${c.ha === true ? 'HA pair' : c.ha === false ? 'Single node' : 'HA not reported'}</strong><span>${c.usedTierGb ? fmtCap(c.usedTierGb) + ' tiered to object storage' : c.type === 'VSA' ? 'No tiering in use' : 'On-prem cluster'}</span></div></div>
          <dl class="config-grid" style="margin-top:16px">${row('Marketplace', c.marketplace ? 'SaaS marketplace' : 'Direct')}${row('Subscription', esc(c.subscription || '—'))}${row('Connector', esc(con.name) + ' · v' + esc(con.version || '?'))}${row('Cluster UUID', esc(c.clusterUuid || '—'))}</dl>
          <div class="source-gap">${ico.info}<div><strong>Workload type, SnapMirror role, backup policy and replication partners are not in this export</strong><span>Add those columns to light this card up.</span></div></div>
        </div>
      </div>

      <details class="raw-panel"><summary class="raw-toggle"><span>All ${M.columns.length} source attributes for this row <small>· straight from the CSV</small></span><b>EXPAND</b></summary>
        <div class="raw-content"><dl class="raw-grid" style="margin-top:14px">${M.columns.map((col, i) => `<div><dt>${esc(col)}</dt><dd>${esc(rawRow[i] === '' ? '—' : rawRow[i])}</dd></div>`).join('')}</dl></div></details>`;
    requestAnimationFrame(() => { const ring = $('#cap-ring'); if (ring && c.util != null) { ring.style.transition = '--ring 1s ease-out'; setTimeout(() => ring.style.setProperty('--ring', `${Math.min(1, c.util) * 360}deg`), 60); } });
    $('#d-con').addEventListener('click', () => go(`#/connector/${encodeURIComponent(con.id)}`));
    $('#d-cust').addEventListener('click', () => go(`#/customer/${encodeURIComponent(c.customer)}/graph`));
    const byName = (a, b) => (M.connectors.get(a.connectorId).name + a.name).localeCompare(M.connectors.get(b.connectorId).name + b.name);
    let sib = (anyFilter() ? selection().cvos : cu.cvos.filter(inScope)).slice().sort(byName);
    if (!sib.includes(c)) sib = cu.cvos.slice().sort(byName);
    const i = sib.indexOf(c); const scope = anyFilter() ? 'filtered systems' : `${c.customer} systems`;
    $('#d-pos').textContent = `${i + 1} of ${sib.length}`; $('#d-pos').title = scope;
    $('#d-prev').disabled = i <= 0; $('#d-next').disabled = i >= sib.length - 1;
    $('#d-prev').title = i > 0 ? `Previous: ${sib[i - 1].name}` : `First of ${sib.length} ${scope}`;
    $('#d-next').title = i < sib.length - 1 ? `Next: ${sib[i + 1].name}` : `Last of ${sib.length} ${scope}`;
    $('#d-prev').addEventListener('click', () => { if (i > 0) go(`#/cvo/${encodeURIComponent(sib[i - 1].id)}`); });
    $('#d-next').addEventListener('click', () => { if (i < sib.length - 1) go(`#/cvo/${encodeURIComponent(sib[i + 1].id)}`); });
  }
  return { show };
})();

/* ------------------------------------------------------------------ story mode */
const Story = (() => {
  let running = false, timer = null, stepNo = 0, skip = null, voice = false, utter = null; const TOTAL = 7;
  const cap = $('#story-caption');
  const canSpeak = () => typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
  function pickVoice() { if (!canSpeak()) return null; const vs = speechSynthesis.getVoices(); return vs.find(v => /en-(GB|US)/i.test(v.lang) && /natural|neural|online/i.test(v.name)) || vs.find(v => /^en/i.test(v.lang)) || null; }
  let speaking = 0, keepAlive = null; const utters = []; // keep references so the browser cannot garbage-collect mid-speech
  const isEdge = /Edg\//.test(navigator.userAgent);
  const sentences = (text) => { // split on sentence ends only (a full stop followed by a space + capital, or end of text) — never inside 42.3% or 9.19.1P2
    const t = String(text).replace(/\s+/g, ' ').trim(); const out = []; let last = 0; const re = /[.!?]+(?=\s+[A-Z"“(]|\s*$)/g; let m;
    while ((m = re.exec(t))) { out.push(t.slice(last, m.index + m[0].length).trim()); last = m.index + m[0].length; }
    if (last < t.length) out.push(t.slice(last).trim()); return out.filter(Boolean);
  };
  const estimateMs = (text) => 1200 + (String(text).split(/\s+/).length / 2.6) * 1000; // ~2.6 words per second at rate 1
  function hardStop() { speaking++; if (canSpeak()) { try { speechSynthesis.cancel(); } catch (e) { } } clearInterval(keepAlive); keepAlive = null; utters.length = 0; }
  async function prewarm() { // first utterance in a session starts 1–3 s late: pay that cost on the chooser click, not on step 1
    if (!canSpeak()) return;
    if (!speechSynthesis.getVoices().length) await new Promise(res => { const t = setTimeout(res, 1200); speechSynthesis.addEventListener('voiceschanged', () => { clearTimeout(t); res(); }, { once: true }); });
    await new Promise(res => { try { const u = new SpeechSynthesisUtterance('ready'); const v = pickVoice(); if (v) u.voice = v; u.volume = 0; u.rate = 2; u.onend = u.onerror = () => res(); utters.push(u); speechSynthesis.speak(u); setTimeout(res, 3500); } catch (e) { res(); } });
  }
  function speak(text) {
    return new Promise(async (res) => {
      if (!voice || !canSpeak()) return res(0);
      const token = ++speaking; const t0 = Date.now();
      try {
        if (speechSynthesis.speaking || speechSynthesis.pending) { speechSynthesis.cancel(); await sleep(250); } // cancel→speak back-to-back swallows the new utterance in Chromium
        const parts = sentences(text); const v = pickVoice(); let i = 0;
        if (!isEdge && !keepAlive) keepAlive = setInterval(() => { if (speechSynthesis.speaking && !speechSynthesis.paused) { speechSynthesis.pause(); speechSynthesis.resume(); } }, 5000); // Chrome stops long speech after ~15 s without this nudge
        const next = () => {
          if (token !== speaking || !running) return res(Date.now() - t0);
          if (i >= parts.length) { clearInterval(keepAlive); keepAlive = null; return res(Date.now() - t0); }
          const part = parts[i++]; const u = new SpeechSynthesisUtterance(part); if (v) u.voice = v; u.lang = (v && v.lang) || 'en-GB'; u.rate = 1.04; u.pitch = 1; utters.push(u);
          let done = false; const finish = () => { if (done) return; done = true; clearTimeout(guard); setTimeout(next, 90); };
          u.onend = finish; u.onerror = (e) => { if (e && e.error === 'interrupted' || e && e.error === 'canceled') { done = true; return; } finish(); };
          const guard = setTimeout(finish, estimateMs(part) * 1.6); // if the browser never reports the end, move on when the sentence must be over
          speechSynthesis.speak(u);
        };
        next();
      } catch (e) { res(0); }
    });
  }
  function say(title, body, narration) {
    stepNo++;
    cap.innerHTML = `<div class="story-progress">${Array.from({ length: TOTAL }, (_, i) => `<i class="${i < stepNo ? 'active' : ''}"></i>`).join('')}</div><button class="story-close" id="story-close" aria-label="Stop guide">✕</button>
      <div class="eyebrow">AUTO GUIDE · ${stepNo} / ${TOTAL}</div><h2>${esc(title)}</h2>${body ? `<p>${esc(body)}</p>` : ''}
      <div class="story-controls"><button id="story-skip">Skip ahead ›</button><button id="story-voice" aria-pressed="${voice}">${voice ? '🔊 Voice on' : '🔇 Voice off'}</button><span>Esc to stop</span></div>`;
    cap.classList.remove('hidden');
    $('#story-close').addEventListener('click', stop); $('#story-skip').addEventListener('click', () => { if (skip) skip(); });
    $('#story-voice').addEventListener('click', () => { voice = !voice; if (!voice) hardStop(); $('#story-voice').textContent = voice ? '🔊 Voice on' : '🔇 Voice off'; $('#story-voice').setAttribute('aria-pressed', voice); });
    return speak(narration || `${title}. ${body || ''}`);
  }
  // wait at least `ms`, or until narration finishes (whichever is later); skip resolves immediately
  async function step(ms, spoken) {
    let skipped = false;
    const skipP = new Promise((res, rej) => { skip = () => { clearTimeout(timer); skip = null; skipped = true; hardStop(); running ? res('skip') : rej(new Error('stopped')); }; });
    const narrated = voice && canSpeak() && spoken;
    // narrated: the step ends when the narration has been spoken to the end (90 s safety ceiling). read-along: fixed timing.
    const waitP = narrated ? Promise.race([spoken, sleep(90000)]) : new Promise((res) => { timer = setTimeout(res, ms); });
    await Promise.race([skipP, waitP]);
    skip = null;
    if (!running) throw new Error('stopped');
    if (!skipped) await sleep(narrated ? 700 : 600);
  }
  function choose() {
    return new Promise((res) => {
      const spk = canSpeak();
      cap.innerHTML = `<button class="story-close" id="story-close" aria-label="Close">✕</button><div class="eyebrow">AUTO GUIDE</div><h2>How would you like the tour?</h2><p>A seven-step walk from the global fleet, to one Connector, to one system. About two minutes.</p>
        <div class="story-choice"><button id="choose-voice" ${spk ? '' : 'disabled title="Speech is not available in this browser"'}><span class="ic">🔊</span><b>Narrated</b><small>Voice-over reads each step aloud${spk ? '' : ' — unavailable here'}</small></button><button id="choose-read"><span class="ic">📖</span><b>Read along</b><small>Captions only, no audio</small></button></div>`;
      cap.classList.remove('hidden');
      const done = (v) => { res(v); };
      $('#story-close').addEventListener('click', () => done(null));
      $('#choose-voice').addEventListener('click', async () => { $('#choose-voice').innerHTML = '<span class="ic">🔊</span><b>Narrated</b><small>starting…</small>'; voice = true; await prewarm(); done(true); });
      $('#choose-read').addEventListener('click', () => done(false));
      $('#choose-read').focus();
    });
  }
  async function play() {
    if (running) return stop();
    $('#btn-story').classList.add('active'); $('#btn-story-label').textContent = 'Stop guide';
    const pick = await choose();
    if (pick === null) { cap.classList.add('hidden'); $('#btn-story').classList.remove('active'); $('#btn-story-label').textContent = 'Auto guide'; return; }
    voice = pick;
    running = true; stepNo = 0;
    try {
      const fixedCustomer = state.filters.customers.size === 1 ? [...state.filters.customers][0] : null;
      go('#/fleet'); Fleet.reset();
      const { cvos, connectors } = selection(); const st = stats(cvos, connectors);
      const who = fixedCustomer ? fixedCustomer : 'the NetApp Cloud Volumes ONTAP fleet';
      let sp = say('One living view of the whole estate.', `${fmtInt(st.cvos)} ONTAP systems · ${fmtInt(st.connectors)} Connectors · ${fmtInt(st.customers)} customers · ${st.countries} countries.`,
        `Welcome to CVO Fleet Intelligence. This is ${who} in a single view: ${fmtInt(st.cvos)} ONTAP systems, managed by ${fmtInt(st.connectors)} NetApp Connectors, across ${fmtInt(st.customers)} customers and ${st.countries} countries. Until now this information lived in spreadsheets; here it is one live picture.`);
      await step(5000, sp);
      const tops = Fleet.topClusters(8); const provName = { aws: 'AWS', azure: 'Azure', gcp: 'Google Cloud', onprem: 'on-premises' };
      const big = tops[0];
      if (big) Fleet.flyTo(big.cl, 2.2, 2600); // step 2: slow push-in towards the densest location while the numbers are read
      sp = say('Capacity and health, at a glance.', `${fmtCap(st.cap)} allocated · ${fmtCap(st.used)} used · ${d3.format('.1%')(st.util || 0)} utilised · ${fmtInt(st.atRisk)} systems need attention.`,
        `The strip at the top summarises the estate. ${fmtCap(st.cap)} of storage is allocated and ${fmtCap(st.used)} is actually in use, which is ${d3.format('.0%')(st.util || 0)} utilisation. The Fleet Intelligence card on the right flags ${fmtInt(st.atRisk)} systems that need attention because of their status or because they are running out of space.`);
      await step(5000, sp);
      // step 3: fly between the largest locations while explaining colour and size
      const other = tops.find(t => t.provider !== big.provider) || tops[1] || big;
      if (big) Fleet.flyTo(big.cl, 3.6, 1600); // step 3: land on it
      sp = say('Every marker is a place where systems run.', `${big ? `${big.city}, ${big.country}: ${fmtInt(big.n)} systems on ${big.k} connectors. ` : ''}Colour is the cloud — orange AWS, blue Azure, green Google Cloud, purple on-premises. Size is how many systems live there.`,
        `Every marker is a location where systems run. The bigger the marker, the more systems live there${big ? `. The largest is ${big.city} in ${big.country}, with ${fmtInt(big.n)} systems managed by ${big.k} connectors, mostly on ${provName[big.provider] || big.provider}` : ''}. Colour tells you the cloud: orange for AWS, blue for Azure, green for Google Cloud, purple for on-premises.${other && other !== big ? ` Over in ${other.city}, the estate runs mainly on ${provName[other.provider] || other.provider}.` : ''} Pick a customer or a country and the map, the numbers and the lists all narrow to that selection.`);
      if (other && other !== big) setTimeout(() => { if (running) Fleet.flyTo(other.cl, 3.2, 2400); }, voice ? 9000 : 2600);
      await step(6500, sp);
      const rep = connectors.slice().sort((a, b) => b.cvos.filter(cvoMatches).length - a.cvos.filter(cvoMatches).length)[0];
      if (!rep) throw new Error('none');
      const shown = rep.cvos.filter(cvoMatches);
      Fleet.zoomToConnector(rep); // step 4: glide across to the busiest Connector (single transition, no reset in between)
      sp = say('Zooming to the busiest Connector.', `${rep.name} · ${rep.customer} · ${shown.length} systems under management.`,
        `Now let us zoom in to the busiest Connector: ${rep.name}, belonging to ${rep.customer}. A Connector is the NetApp agent that deploys and manages Cloud Volumes ONTAP systems. This one looks after ${shown.length} systems. Let us open it.`);
      await step(4200, sp);
      go(`#/connector/${encodeURIComponent(rep.id)}`); await sleep(500);
      Graph.zoomHub(1.9, 900); setTimeout(() => { if (running) Graph.fitView(1600); }, voice ? 5000 : 2200);
      sp = say('The Connector and everything it manages.', 'Centre: the Connector. Around it: every ONTAP system it manages, coloured by health — teal healthy, amber watch, red failed.',
        `This is the relationship map. The Connector sits in the centre and every system it manages sits around it, coloured by health: teal is healthy, amber needs a look, red is failed. The panel on the left describes the Connector: where it runs, its version, and a health roll-up.`);
      await step(4500, sp);
      const cv = shown.slice().sort((a, b) => (b.capGb || 0) - (a.capGb || 0))[0];
      Graph.focusNode(n => n.type === 'cvo' && n.ref === cv);
      sp = say(`Largest system: ${cv.name}.`, cv.capGb ? `${fmtCap(cv.capGb)} allocated · ${fmtPct(cv.util)} used · ONTAP ${cv.ontapRaw || '—'}.` : 'Capacity not reported in the export.',
        `The largest system here is ${cv.name}${cv.capGb ? `, with ${fmtCap(cv.capGb)} allocated and ${fmtPct(cv.util)} in use` : ''}. Clicking any system opens its full profile.`);
      await step(4000, sp);
      go(`#/cvo/${encodeURIComponent(cv.id)}`);
      sp = say('Everything the export knows about one system.', 'Capacity ring · configuration · telemetry · how it compares with its peers · rule-based insights. All 68 source columns are one click away.',
        `Here is the deep dive: how full it is, how it is configured, whether AutoSupport and high availability are on, how it compares with the customer's other systems, and the automatic flags such as nearing capacity or an old ONTAP release. Every column from the source export is available at the bottom. That is the journey: from the whole fleet, to one Connector, to one system, in three clicks. Returning to the global view.`);
      await step(7000, sp);
    } catch (e) { /* stopped */ }
    finally { finish(); }
  }
  function finish() { const was = running; stop(); if (was) { go('#/fleet'); setTimeout(() => { Fleet.reset(); }, 400); } }
  function stop() { running = false; clearTimeout(timer); skip = null; hardStop(); cap.classList.add('hidden'); $('#btn-story').classList.remove('active'); $('#btn-story-label').textContent = 'Auto guide'; Graph.clearFocus && Graph.clearFocus(); }
  return { play, stop, get running() { return running; } };
})();

/* ------------------------------------------------------------------ exports & data modal */
function exportCSV() {
  const { cvos } = selection();
  const q = (v) => { v = String(v ?? ''); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const lines = [M.columns.map(q).join(',')]; for (const c of cvos) lines.push(M.rows[c.rowIndex].map(q).join(','));
  download(`cvo-fleet-filtered-${cvos.length}.csv`, new Blob([lines.join('\n')], { type: 'text/csv' })); toast(`Exported ${fmtInt(cvos.length)} rows`);
}
function exportPNG() { if (state.layer === 'fleet') Fleet.exportPNG(); else if (state.layer === 'graph') Graph.exportPNG(); else toast('Use your browser print (Ctrl/Cmd+P) to capture the detail page'); }
function showDataModal() {
  const mapped = M.report.filter(r => r.header), missing = M.report.filter(r => !r.header);
  const unmapped = M.cvos.filter(c => !c.loc).length;
  $('#modal-body').innerHTML = `
    <label class="drop-zone" id="drop-zone" tabindex="0"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><strong>Drop a fleet CSV export here, or click to browse</strong><span>Columns are auto-mapped by header name · the embedded export stays as fallback</span><input type="file" accept=".csv,text/csv" id="file-input" style="display:none"></label>
    <div class="source-summary"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg><div><strong>${esc($('#source-name').textContent)} · ${fmtInt(M.rows.length)} rows · ${M.columns.length} columns</strong><span>Build ${BUILD_STAMP}</span><span>${fmtInt(M.connectors.size)} connectors · ${fmtInt(M.customers.size)} customers · latest GA ONTAP observed ${M.latest ? esc(M.latest.label) : '?'} · ${fmtInt(unmapped)} systems without a location</span></div></div>
    <div class="mapping-heading"><div><strong>Column mapping</strong><span>${mapped.length} of ${M.report.length} internal fields matched</span></div><small>source header → internal field</small></div>
    <div class="mapping-list">${mapped.map(r => `<div><code>${esc(r.header)}</code><span>→</span><b>${esc(r.field)}</b><em>${r.how}</em></div>`).join('')}</div>
    ${missing.length ? `<div class="warning-list">${missing.map(r => `<span>⚠ <code>${esc(r.field)}</code> not present in export — its card degrades gracefully</span>`).join('')}</div>` : ''}
    <h3>Assumptions</h3>
    <p>Health is derived from <code>cvo_status</code> (ON = healthy; DEGRADED / OFF / INITIALIZING / UPDATING = warning; FAILED / FAILED_TO_CREATE / NOT_FOUND = critical) and flips to warning above 85% utilisation. Utilisation = (used disk + used tiering) ÷ capacity. Each system is placed at its own cloud region; an on-prem system reporting through a cloud Connector is placed where that Connector runs; on-prem systems on on-prem Connectors have no location and are listed separately. Version drift = 3+ minor releases behind the fleet-latest GA release. AMER / EMEA / APAC are derived from longitude. Capacity is taken as-is from the <code>*_gb</code> columns. Filters apply to each system — customer first, then every other filter narrows within it (or within the whole fleet when no customer is chosen). Scope “Cloud CVO” hides on-prem ONTAP systems; “All managed” includes them.</p>`;
  $('#modal-body').insertAdjacentHTML('beforeend', validationTable());
  const fi = $('#file-input'); fi.addEventListener('change', () => { if (fi.files[0]) { handleDrop(fi.files[0]); $('#modal').classList.add('hidden'); } });
  $('#modal').classList.remove('hidden'); $('#modal-close').focus();
}
// Cross-check: numbers recomputed directly from the raw CSV rows by header name (no model logic involved)
function validationTable() {
  const col = (n) => M.columns.findIndex(c => c.toLowerCase() === n);
  const iCust = col('customer'), iCon = col('connector_id'), iCvo = col('cvo_identifier'), iSt = col('cvo_status'), iCap = col('cvo_capacity_gb'), iUd = col('cvo_used_capacity_disk_gb'), iUt = col('cvo_used_capacity_tiering_gb');
  if (iCust < 0) return '';
  const sel = state.filters.customers.size ? [...state.filters.customers] : null;
  const rows = sel ? M.rows.filter(r => sel.includes(r[iCust])) : M.rows;
  const uniq = (i) => i >= 0 ? new Set(rows.map(r => r[i]).filter(Boolean)).size : '—';
  const sum = (i) => i >= 0 ? d3.sum(rows, r => +r[i] || 0) : 0;
  const byStatus = iSt >= 0 ? [...d3.rollup(rows, v => v.length, r => r[iSt] || 'blank')].sort((a, b) => b[1] - a[1]) : [];
  const shown = selection(); const st = stats(shown.cvos, shown.connectors);
  return `<h3>Cross-check against the raw CSV ${sel ? '— ' + sel.map(esc).join(', ') : '— entire export'}</h3>
    <p>Left column is counted straight from the CSV rows by header name; right column is what the dashboard shows for the same customer selection (other filters ignored on the left).</p>
    <table><tr><th>Measure</th><th>Raw CSV</th><th>Dashboard</th></tr>
      <tr><td>Rows (one per system)</td><td>${fmtInt(rows.length)}</td><td>${fmtInt(sel ? M.cvos.filter(c => sel.includes(c.customer)).length : M.cvos.length)}</td></tr>
      <tr><td>Distinct <code>connector_id</code></td><td>${fmtInt(uniq(iCon))}</td><td>${fmtInt(new Set((sel ? M.cvos.filter(c => sel.includes(c.customer)) : M.cvos).map(c => c.connectorId)).size)}</td></tr>
      <tr><td>Distinct <code>cvo_identifier</code></td><td>${fmtInt(uniq(iCvo))}</td><td>—</td></tr>
      <tr><td>Σ <code>cvo_capacity_gb</code></td><td>${fmtInt(sum(iCap))} GB = ${fmtCap(sum(iCap))}</td><td>${fmtCap(d3.sum(sel ? M.cvos.filter(c => sel.includes(c.customer)) : M.cvos, c => c.capGb || 0))}</td></tr>
      <tr><td>Σ used (disk + tiering)</td><td>${fmtInt(sum(iUd) + sum(iUt))} GB = ${fmtCap(sum(iUd) + sum(iUt))}</td><td>${fmtCap(d3.sum(sel ? M.cvos.filter(c => sel.includes(c.customer)) : M.cvos, c => c.usedGb || 0))}</td></tr>
      ${byStatus.map(([k, v]) => `<tr><td><code>cvo_status</code> = ${esc(k)}</td><td>${fmtInt(v)}</td><td>${fmtInt((sel ? M.cvos.filter(c => sel.includes(c.customer)) : M.cvos).filter(c => c.status === k).length)}</td></tr>`).join('')}
    </table>
    <p style="margin-top:10px">With the current scope (${state.scope === 'cloud' ? 'Cloud CVO — on-prem ONTAP excluded' : 'All managed'}) and all filters applied, the dashboard shows ${fmtInt(st.cvos)} systems on ${fmtInt(st.connectors)} connectors.</p>`;
}

/* ------------------------------------------------------------------ load & boot */
function loadModel(columns, rows) {
  M = buildModel(columns, rows);
  Fleet.clearAll(); Fleet.fillFilterOptions(); Fleet.refreshMS(); Fleet.render(); Fleet.applyFilters(false);
}
function handleDrop(file) {
  const rd = new FileReader();
  rd.onload = () => { try { const { columns, rows } = parseCSV(rd.result); if (!rows.length) throw new Error('empty'); loadModel(columns, rows); $('#source-name').textContent = file.name.toUpperCase(); go('#/fleet'); toast(`Loaded ${fmtInt(rows.length)} rows from ${file.name}`); } catch (e) { toast('Could not parse that file as CSV'); } };
  rd.readAsText(file);
}
function boot() {
  const embedded = JSON.parse($('#cvo-data').textContent);
  M = buildModel(embedded.columns, embedded.rows);
  Fleet.init(); Graph.init(); Fleet.applyFilters(false);
  window.addEventListener('hashchange', route); route();

  // top bar
  $('#btn-story').addEventListener('click', () => Story.play());
  $('#btn-export-csv').addEventListener('click', exportCSV);
  $('#btn-export-png').addEventListener('click', exportPNG);
  $('#btn-cb').addEventListener('click', (e) => { const on = document.body.classList.toggle('colorblind'); e.currentTarget.setAttribute('aria-pressed', on); e.currentTarget.classList.toggle('active', on); Fleet.applyFilters(false); if (state.layer === 'graph') Graph.show(state.connectorId ? 'connector' : 'customer'); });
  $('#brand').addEventListener('click', () => { if (Story.running) Story.stop(); Fleet.clearAll(); go('#/fleet'); Fleet.applyFilters(true); });
  $('#brief-close').addEventListener('click', () => { $('#brief').classList.add('hidden'); $('#brief-toggle').style.display = 'flex'; });
  $('#brief-toggle').addEventListener('click', () => { $('#brief').classList.remove('hidden'); $('#brief-toggle').style.display = ''; });
  $('#btn-data').addEventListener('click', showDataModal);
  $('#modal-close').addEventListener('click', () => $('#modal').classList.add('hidden'));
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') $('#modal').classList.add('hidden'); });
  $('#btn-present').addEventListener('click', togglePresent);

  // keyboard
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input,select,textarea')) return;
    if (e.key === 'Escape') { if (!$('#modal').classList.contains('hidden')) return $('#modal').classList.add('hidden'); if (Story.running || !$('#story-caption').classList.contains('hidden')) return Story.stop(); if (!$('#cluster-list').classList.contains('hidden')) return $('#cluster-list').classList.add('hidden'); back(); }
    else if (e.key === 'ArrowLeft') back();
    else if (e.key === 'ArrowRight') forward();
    else if (e.key === 'f' || e.key === 'F') togglePresent();
    else if (e.key === '/') { e.preventDefault(); const inp = state.layer === 'graph' ? $('#g-search') : $('#f-search'); inp && inp.focus(); }
  });
  // drag & drop CSV
  const ov = $('#drop-overlay'); let dragDepth = 0;
  document.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; ov.classList.remove('hidden'); });
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; ov.classList.add('hidden'); } });
  document.addEventListener('drop', (e) => { e.preventDefault(); dragDepth = 0; ov.classList.add('hidden'); const f = e.dataTransfer.files[0]; if (f) handleDrop(f); });
}
function back() {
  if (state.layer === 'cvo') go(`#/connector/${encodeURIComponent(state.connectorId)}`);
  else if (state.layer === 'graph') { if (state.connectorId) { const con = M.connectors.get(state.connectorId); state.connectorId = null; go(`#/customer/${encodeURIComponent(con.customer)}/graph`); } else go(state.customer ? `#/customer/${encodeURIComponent(state.customer)}` : '#/fleet'); }
  else if (anyFilter()) { Fleet.clearAll(); Fleet.applyFilters(true); go('#/fleet'); }
}
function forward() {
  if (state.layer === 'fleet') { const { connectors } = selection(); const rep = connectors.filter(c => c.loc).sort((a, b) => b.cvos.length - a.cvos.length)[0] || connectors[0]; if (rep) go(`#/connector/${encodeURIComponent(rep.id)}`); }
  else if (state.layer === 'graph') { if (state.connectorId) { const con = M.connectors.get(state.connectorId); const cv = con.cvos.slice().sort((a, b) => (b.capGb || 0) - (a.capGb || 0))[0]; if (cv) go(`#/cvo/${encodeURIComponent(cv.id)}`); } else { const cu = M.customers.get(state.customer); const con = [...cu.connectors].map(id => M.connectors.get(id)).sort((a, b) => b.cvos.length - a.cvos.length)[0]; if (con) go(`#/connector/${encodeURIComponent(con.id)}`); } }
}
function togglePresent() {
  state.present = document.body.classList.toggle('presentation'); $('#btn-present').setAttribute('aria-pressed', state.present); $('#btn-present').classList.toggle('active', state.present);
  Fleet.setHover(!state.present);
  try { if (state.present && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen(); else if (!state.present && document.fullscreenElement) document.exitFullscreen(); } catch (e) { }
  setTimeout(() => { Fleet.resize(); Graph.resize(); }, 350);
}
document.addEventListener('DOMContentLoaded', boot);
