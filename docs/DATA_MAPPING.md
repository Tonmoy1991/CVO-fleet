# Data mapping — source header → internal field

Source: `data/TonmoyTest_2026_09_18.csv` · 3,690 rows (one per ONTAP system) · 68 columns.
All 50 internal fields matched a header **exactly**. Matching is case-insensitive; fuzzy (substring) matching is the fallback.
The live mapping report is also available in the app under **Data**.

## Customer
| Internal | Source header |
|---|---|
| customer_name | `customer` |
| customer_domain | `customer_company` |

## Connector
| Internal | Source header |
|---|---|
| connector_id | `connector_id` |
| connector_name | `connector_name` |
| connector_provider | `connector_provider` |
| connector_region | `connector_region` |
| connector_version | `connector_occm_version` |
| connector_deployment | `connector_occm_deployment` |
| connector_host | `connector_occm_host` |
| connector_network / connector_subnet | `connector_network` / `connector_subnet` |
| connector_account | `connector_account_id` |
| connector_first_seen / connector_last_seen | `connector_first_seen` / `connector_last_seen` |
| connector_active | `connector_is_active_latest_monitoring_day` |
| connector_status | `connector_cm_agents_status` |
| connector_docker | `connector_use_docker_infra` |

## CVO / ONTAP system
| Internal | Source header |
|---|---|
| cvo_id | `cvo_identifier` |
| cvo_we_id | `cvo_we_id` |
| cvo_name | `cvo_name` |
| cvo_type | `cvo_we_type` (VSA = Cloud Volumes ONTAP, ON_PREM = on-prem ONTAP) |
| cvo_status | `cvo_status` |
| cvo_provider | `cvo_deployment` |
| cvo_deployment_type | `cvo_deployment_type` |
| cvo_region | `cvo_region` |
| cvo_instance | `cvo_instance_type` |
| cvo_ontap | `cvo_ontap_version` |
| cvo_ha | `cvo_is_ha` |
| cvo_payment / cvo_license / cvo_package | `cvo_payment` / `cvo_license_type` / `cvo_capacity_license_package` |
| cvo_capacity_based | `cvo_is_capacity_based_license` |
| cvo_capacity_gb | `cvo_capacity_gb` |
| cvo_allocated_gb | `cvo_allocated_capacity_gb` |
| cvo_used_disk_gb / cvo_used_tier_gb | `cvo_used_capacity_disk_gb` / `cvo_used_capacity_tiering_gb` |
| cvo_raw_gb | `cvo_raw_capacity_gb` |
| cvo_volumes / cvo_luns / cvo_aggregates | `cvo_volumes` / `cvo_luns` / `cvo_aggregates` |
| cvo_asup | `cvo_sends_asup` |
| cvo_serial / cvo_serial2 | `cvo_serial_1` / `cvo_serial_2` |
| cvo_marketplace / cvo_subscription | `cvo_saas_marketplace` / `cvo_saas_subscription_id` |
| cvo_cluster_uuid | `cvo_cluster_uuid` |
| cvo_last_active / cvo_first_seen / cvo_last_seen / cvo_snapshot | `cvo_last_active` / `cvo_first_seen` / `cvo_last_seen` / `cvo_snapshot_date` |

## Derived
| Derived | Rule |
|---|---|
| health | from `cvo_status` (see README); healthy & utilisation > 85 % → warning |
| utilisation | (used disk + used tiering) ÷ capacity_gb |
| location | gazetteer lookup of `cvo_region` (GCP zone suffix stripped, Azure names lower-cased); else the Connector's location; else none |
| geo | AMER (lon < −30) · EMEA (−30…60) · APAC (> 60) · On-prem (no location) |
| version drift | 3+ minor releases behind fleet-latest GA release (code-named builds ignored) |
| at risk | health ≠ healthy |

## Not present in the export (cards degrade gracefully)
Workload type · SnapMirror role / replication partner · backup policy · capacity time series · Connector CPU/memory · customer HQ location.
