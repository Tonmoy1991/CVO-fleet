# CVO Fleet Intelligence

> **Live dashboard:** https://tonmoy1991.github.io/CVO-fleet/ (published automatically from `main` by GitHub Actions)
> **Single file:** [`release/cvo-fleet.html`](release/cvo-fleet.html) — download and open in Edge.

Interactive, presentation-grade dashboard of the NetApp Cloud Volumes ONTAP fleet:
**global fleet map → Connector topology (Obsidian-style) → CVO deep dive**, with cascading filters,
a narrated auto-guide, exports and a raw-CSV cross-check.

Two deliverables come out of this repository and they are **the same application**:

| Deliverable | What it is | When to use it |
|---|---|---|
| `release/cvo-fleet.html` | ONE self-contained file (HTML + CSS + JS + embedded data). Double-click to open. | Presenting, emailing, USB stick, the EBC laptop |
| this project | The same code split into editable source, a build script and tests | Maintaining, re-building with a new export, hosting |

> `npm run verify` proves the project rebuilds `release/cvo-fleet.html` byte-for-byte.
> Nothing in the project changes the tested behaviour — the split is purely organisational.

## Quick start

```bash
npm install            # nothing to install (zero dependencies) — safe to skip
npm run build          # → dist/index.html  (the single-file dashboard)
npm run dev            # build + serve at http://localhost:5173
npm test               # data/filter regression tests (Arup = 39/20, UK = 111/51, FAILED = 354 …)
npm run verify         # rebuild and compare with release/cvo-fleet.html
```

Requires Node.js 18+. No bundler, no framework, no `node_modules`.

### Rebuild with a new fleet export

```bash
node scripts/build.mjs --csv path/to/new_export.csv --out dist/index.html
```
Columns are matched by header name (see `docs/DATA_MAPPING.md`). Alternatively drop the CSV onto the
running dashboard, or use **Data → drop zone** — no rebuild needed.

## Project layout

```
cvo-fleet-intelligence/
├── src/
│   ├── index.template.html     page structure; placeholders /*__CSS__*/ /*__JS__*/ __DATA__ __GAZ__
│   ├── styles/app.css          visual system — [THEME] tokens at the top
│   └── scripts/app.js          application — zones marked [DATA] [MAP] [GRAPH]
├── data/
│   ├── TonmoyTest_2026_09_18.csv      master export (embedded at build time)
│   └── cloud_region_gazetteer.json    cloud region → city / country / lat / lon
├── scripts/
│   ├── build.mjs               fuses src + data → one HTML file
│   └── verify.mjs              byte-compare against release/
├── spec/model.test.cjs         runs the real app code in Node against the real CSV
├── release/cvo-fleet.html      the released single file (reference copy)
├── dist/                       build output (git-ignored)
└── docs/                       master prompt, data mapping, EBC talk track, Obsidian reference
```

### `src/scripts/app.js` — map of the code

| Section | Responsibility |
|---|---|
| `[THEME]` | colour tokens, health/provider colour helpers |
| `[DATA]` | `FIELD_MAP` (header → field), `buildModel()` (customers / connectors / CVOs, locations, health, drift), `parseCSV()` |
| `state` / `FILTER_DEFS` | filter state; `cvoMatches()` (customer first, then every other filter on the system itself), `cvoMatchesExcept()` (cascading option lists), `selection()`, `stats()` |
| routing | hash routes `#/fleet`, `#/customer/<name>`, `#/customer/<name>/graph`, `#/connector/<id>`, `#/cvo/<id>` |
| `Fleet` `[MAP]` | D3 Natural Earth map, location clusters, labels with occlusion, KPI strip, Fleet Intelligence brief, rails, customer picker, cascading dropdowns, scope switch, search, PNG export |
| `Graph` `[GRAPH]` | static radial Connector → CVO layout on canvas, hover isolation, colour-by, context nodes, panel |
| `Detail` | CVO deep-dive page (capacity ring, configuration, telemetry, peer comparison, insights, raw row, Prev/Next) |
| `Story` | Auto guide — narrated (Web Speech, sentence-synchronised) or read-along |
| data manager | column-mapping report, assumptions, raw-CSV cross-check table, drag-and-drop reload |

## Behaviour contract (tested)

* Filters are evaluated **per system**: customer first, then every other filter narrows within it
  (or within the whole estate when no customer is chosen). Dropdown options cascade accordingly.
* A system is placed at **its own cloud region**; an on-prem system reporting through a cloud Connector is
  placed where that Connector runs; on-prem systems on on-prem Connectors have no location (listed separately).
* Health: `ON` → healthy · `DEGRADED/OFF/INITIALIZING/UPDATING` → warning · `FAILED/FAILED_TO_CREATE/NOT_FOUND` → critical;
  healthy above 85 % utilisation → warning. Utilisation = (used disk + used tiering) ÷ capacity.
* Version drift = 3+ minor releases behind the fleet-latest GA ONTAP. AMER/EMEA/APAC from longitude.
* Default scope **All managed**; **Cloud CVO** hides on-prem ONTAP.

## Publishing (GitHub Pages)

Every push to `main` runs `npm test`, builds `dist/index.html` and publishes it to GitHub Pages
(`.github/workflows/pages.yml`). To refresh the data: replace `data/TonmoyTest_2026_09_18.csv`
(or point `scripts/build.mjs --csv` at a new file in the workflow), commit, push — the live URL updates in ~1 minute.

## Runtime notes

* Libraries: d3 7.9.0 and topojson-client 3.1.0 from jsDelivr (pinned). Coastlines are fetched at runtime;
  offline, the map degrades to a graticule globe and everything else works.
* Narration uses the browser's built-in speech engine — Microsoft Edge gives the most natural voices.
* Keyboard: `←/→` layers · `Esc` back · `F` presentation · `/` search.

Designed by Tonmoy Mukherjee · CSE, NetApp.
