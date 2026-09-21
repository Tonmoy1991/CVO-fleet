# Master Prompt — NetApp CVO Fleet Intelligence Dashboard (EBC Edition)

> **How to use:** Paste everything from `=== PROMPT START ===` to `=== PROMPT END ===` into your LLM of choice.
> Attach (a) the backend Excel/CSV export and (b) the Obsidian graph-view screenshot before running.
> Sections are modular — you can run Section 5 (Page 1), Section 6 (Page 2), Section 7 (Page 3) independently if the model's output window is limited.

---

=== PROMPT START ===

## 1. ROLE

You are a **senior front-end data-visualization engineer and information designer**, expert in D3.js, deck.gl, Mapbox/MapLibre, Cytoscape.js, and executive-grade dashboard design. You build presentation-grade, interactive web dashboards used live in front of C-level audiences.

## 2. CONTEXT

I am a Cloud Solution Architect at NetApp supporting **Azure NetApp Files (ANF)** and **Cloud Volumes ONTAP (CVO)**. My customer **ARUP** is a global engineering firm running CVO instances and BlueXP **Connectors** across many geographies. They have **no consolidated view** of:
- how many Connectors exist and where they sit,
- which CVO instances each Connector manages,
- the configuration, capacity, and health of each CVO.

I must present this at an **Executive Briefing Center (EBC)** to ~100 people, live. The deliverable is **not a spreadsheet** — it is an **interactive, multi-layered web dashboard** that tells the story from global fleet → region/connector → individual CVO.

## 3. DESIGN MANDATE (non-negotiable)

- **Minimalist but stunning.** Dark, near-black canvas (`#0B0E14`), generous whitespace, one accent color family. Think Stripe/Vercel/Linear aesthetics, not corporate BI.
- **Motion with purpose.** Smooth 300–500 ms eased transitions on every drill-down; animated map pulses; no gratuitous bounce.
- **Presentation-safe:** legible from the back of a 100-seat room — minimum 16 px body text, 28 px+ KPI numerals, high contrast.
- **Keyboard-driven:** `←`/`→` navigate layers, `Esc` returns to previous layer, `F` toggles fullscreen/presentation mode.
- **Zero-dependency deployment:** must run from a single `index.html` opened directly in a browser (offline-capable, CDN-optional fallback). No build step, no server.
- **Palette:** background `#0B0E14`, surface `#141922`, primary accent `#00D3A7` (NetApp-adjacent teal), secondary `#3B82F6`, warning `#F59E0B`, critical `#EF4444`, text `#E6EAF2` / muted `#8A93A5`.
- **Typography:** Inter or system UI stack; tabular numerals for all metrics.

## 4. DATA CONTRACT

Ingest the attached Excel/CSV. Normalize into this internal model; **auto-map columns by fuzzy header matching** and print a mapping report. If a field is missing, degrade gracefully (hide the card, never crash).

```
Customer   { customer_id, customer_name, industry, region_primary }
Connector  { connector_id, connector_name, customer_id, cloud_provider,
             region, country, city, latitude, longitude, version,
             status, deployment_mode, subscription_id, created_date }
CVO        { cvo_id, cvo_name, connector_id, customer_id, cloud_provider,
             region, latitude, longitude, ontap_version, license_type,
             ha_or_single, instance_type, provisioned_tb, used_tb,
             free_tb, efficiency_ratio, volume_count, aggregate_count,
             workload_type, snapmirror_role, backup_enabled,
             status, health, created_date, last_seen }
```

**Derived metrics to compute:** total CVOs, total Connectors, countries covered, total provisioned vs used TB, fleet utilization %, storage-efficiency savings, CVOs per Connector (avg/max), orphaned CVOs (no Connector), version-drift count (CVOs not on latest ONTAP), at-risk count (utilization > 85% or health ≠ healthy).

**If no file is attached:** generate a realistic synthetic dataset — 12 customers, ~40 Connectors, ~180 CVOs across AMER/EMEA/APAC — clearly flagged as `DEMO DATA`, and keep the ingestion layer intact so the real file drops in cleanly.

## 5. LAYER 1 — GLOBAL FLEET MAP (landing page)

- Full-bleed **dark world map** (MapLibre GL, or a D3 orthographic/Natural Earth projection as offline fallback).
- **Connector markers** — not CVOs — plotted at lat/long. Marker **radius scales with the number of CVOs attached**; marker carries a soft **pulsing halo**. Overlapping markers **cluster** by region with a count badge; clusters expand on zoom.
- Optional subtle **great-circle arcs** from each Connector to a customer HQ node, animated with a slow travelling gradient — toggleable, off by default to avoid clutter.
- **Top-left KPI strip** (glassmorphic, auto-animating count-up on load): Total CVOs · Total Connectors · Countries · Provisioned TB · Used TB · Fleet Utilization %.
- **Top-right control bar:**
  - **Customer selector** — searchable dropdown supporting **both single and multi-select**, with "Select all / Clear" and chip-style selected tags. Default state = **entire NetApp fleet**.
  - Secondary filters: cloud provider, region, status/health, ONTAP version.
- On customer selection: non-matching markers **fade to 8% opacity** (do not disappear — keeps global scale visible), the map **eases to fit the selection's bounds**, and every KPI re-animates to the filtered values.
- **Hover** a Connector → compact tooltip: connector name, city/region, cloud, version, status, CVO count, total TB.
- **Click** a Connector → transition to Layer 2.
- Bottom rail: a slim **regional distribution bar** (AMER / EMEA / APAC / others) and a legend.

## 6. LAYER 2 — CONNECTOR TOPOLOGY (Obsidian graph style)

**Reference the attached screenshot for the visual language.** Reproduce an Obsidian-graph-view aesthetic:

- **Force-directed node graph** (D3 force simulation or Cytoscape.js `cose` layout) on the same dark canvas.
- **Center node = the selected Connector** — largest, accent-glowing, labelled.
- **Satellite nodes = attached CVO instances**; node **size ∝ provisioned capacity**, node **color ∝ health** (teal healthy / amber warning / red critical) or a user-toggled dimension (license type, ONTAP version, workload).
- **Edges:** thin, semi-transparent, gently curved; **thickness ∝ used capacity**; animated dashed flow for SnapMirror/replication relationships where the data indicates them.
- **Physics is live:** nodes are draggable, the graph settles smoothly, zoom/pan with wheel and drag, double-click to re-center.
- **Hover** a node → dim all unconnected nodes and edges to ~15% opacity, highlight the neighborhood (exactly like Obsidian).
- **Left side panel** — Connector detail card: name, ID, cloud, region/city, version, status, deployment mode, subscription ID, created date, managed-CVO count, aggregate capacity, health roll-up.
- **Local controls:** color-by dimension toggle, label on/off, link-distance slider, search-to-focus box.
- **Breadcrumb** top-left: `Global Fleet › <Customer> › <Connector>` — every crumb clickable.
- **Click** a CVO node → transition to Layer 3.

## 7. LAYER 3 — CVO DEEP DIVE

Single-CVO detail page, split into a clean card grid:

1. **Header:** CVO name, health pill, region, cloud badge, Connector it reports to (clickable back-link).
2. **Capacity ring** — provisioned vs used vs free, with utilization % in the center and storage-efficiency savings called out.
3. **Configuration card:** ONTAP version, license type, HA vs single-node, instance type, aggregate count, volume count, created date, last seen.
4. **Workload & data protection card:** workload type, SnapMirror role (source/destination), backup enabled, replication partner (linked if present in data).
5. **Capacity trend sparkline** — render if time-series columns exist; otherwise show an honest "trend data not available in source export" state.
6. **Peer comparison bar** — this CVO's utilization vs the customer's fleet median.
7. **Raw attribute table** — every remaining column from the source row, collapsible.
8. **Insights strip** — auto-generated, rule-based flags: nearing capacity, version drift, no backup configured, orphaned from Connector.

## 8. CROSS-CUTTING FEATURES

- **Presentation Mode (`F`)** — hides chrome, enlarges type, disables tooltips-on-hover in favor of click-only, for stage use.
- **Guided Story Mode** — an optional "Play" button that auto-walks Layer 1 → a representative Connector → a representative CVO with captioned callouts, for the opening 90 seconds of the EBC.
- **Deep-linkable state** via URL hash (`#/customer/ARUP/connector/CN-042`) so you can jump straight to a slide-equivalent view.
- **Export:** "Download current view as PNG" and "Export filtered rows as CSV".
- **Empty/error states** designed, not default. Loading skeletons, not spinners.
- **Accessibility:** ARIA labels on interactive nodes, focus rings, colorblind-safe alternate palette toggle.
- **Performance target:** 60 fps with 200 Connectors and 2,000 CVOs; use canvas/WebGL rendering above 500 nodes.

## 9. OUTPUT REQUIREMENTS

Deliver a **single self-contained `index.html`** containing all HTML, CSS, and JavaScript, with:
- an embedded, clearly delimited `DATA` block at the top that I can swap out;
- a **drag-and-drop file input** so I can drop the Excel/CSV in at runtime (parse with SheetJS/PapaParse from CDN, with the embedded data as fallback);
- inline comments marking the four zones I may want to edit: `// [DATA]`, `// [THEME]`, `// [MAP]`, `// [GRAPH]`.

After the code, provide:
1. A short **column-mapping report** (source header → internal field).
2. A **90-second EBC talk track** — what to say and click on each layer.
3. A list of **assumptions made** and **data gaps** that would improve the dashboard if filled.

Do not truncate code or use placeholder comments like "rest of implementation here." Produce complete, runnable output.

=== PROMPT END ===

---

## Appendix A — Attachment checklist before running

| Asset | Purpose | Status |
|---|---|---|
| Backend Excel/CSV fleet export | Real data for all three layers | ⬜ to attach |
| Obsidian graph-view screenshot | Visual reference for Layer 2 | ⬜ to attach |
| ARUP / NetApp brand assets (optional) | Logo lockup on title bar | ⬜ optional |

## Appendix B — Model-specific tweaks

- **Claude:** run as-is; ask for an artifact. Best single-shot fidelity for the full HTML.
- **GPT:** add "Use the code interpreter to parse the attached file and inline the parsed JSON into the DATA block."
- **Gemini:** run Sections 5, 6, 7 as three separate passes, then a fourth pass to merge into one file.
