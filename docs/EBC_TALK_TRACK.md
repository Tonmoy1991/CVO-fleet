# EBC talk track (≈ 2 minutes)

Open `release/cvo-fleet.html` in Edge. Press **F** for presentation mode. Optionally press **▶ Auto guide → Narrated** and let it run —
the sequence below is the same one the guide follows.

| Time | Screen | Say |
|---|---|---|
| 0:00 | Global fleet | "Every dot is a place where ONTAP systems run. 3,690 systems, 1,129 Connectors, 549 customers, 30 countries — in one live view, straight from the export." |
| 0:20 | KPI strip / Fleet Intelligence | "1.19 EB allocated, 515 PB used, 42 % utilisation. The card on the right tells us where to look: 1,008 systems need attention — a failed status or over 85 % full." |
| 0:40 | Type a customer | "Pick a customer — say Arup — and everything narrows: 39 systems, 20 Connectors, 11 countries. Every dropdown now only offers what Arup actually has: Azure and on-prem." |
| 1:00 | Click the busiest marker → Connector | "A Connector is the NetApp agent that deploys and manages CVO. Here it is in the centre; every system it manages around it, coloured by health. Hover to isolate, click to open." |
| 1:30 | Click the largest node → CVO | "Everything the export knows about one system: capacity, configuration, telemetry, how it compares with the customer's other systems, and automatic flags — nearing capacity, version drift, single node." |
| 1:50 | Esc · Esc | "Fleet, Connector, system — three clicks. And the Data button shows the raw-CSV cross-check for any number on screen." |

Tips: `/` focuses search · `←/→` move between layers · the Data panel shows the build stamp and column mapping if anyone asks where a figure came from.
