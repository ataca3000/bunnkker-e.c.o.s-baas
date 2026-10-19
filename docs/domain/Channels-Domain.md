# Channels Domain

**Status:** Approved (Domain Sprint 02)
**Layer:** Commerce

---

## 1. Channel Identity

A **Channel** is a first-class business entity in ECOS ERP.

A Channel is NOT a connector or a configuration setting.

A Channel represents a commerce integration point through which orders flow into ECOS.

### Channel Types

| Type | Examples |
|------|---------|
| `woocommerce` | WooCommerce store |
| `shopify` | Shopify store |
| `magento` | Magento store |
| `tiktok_shop` | TikTok Shop |
| `manual` | Manually entered orders |
| `phone` | Phone orders created by CS team |
| `whatsapp` | WhatsApp commerce orders |
| `marketplace` | Amazon, Noon, Jumia |

---

## 2. Channel Entity

```
Channel
├── id
├── name
├── type: ChannelType
├── status: ChannelStatus
├── owner_team → Team
├── logo_url
├── settings
│   ├── default_currency
│   ├── default_warehouse_id → Warehouse
│   ├── default_price_list_id → PriceList
│   └── default_shipping_rules
├── sync_config
│   ├── supports_products: boolean
│   ├── supports_orders: boolean
│   ├── supports_customers: boolean
│   ├── sync_interval_minutes: number
│   └── auto_sync_enabled: boolean
├── health: ChannelHealth
├── created_at
├── last_sync_at
├── last_successful_sync_at
└── last_failed_sync_at
```

### Channel Status

| Status | Description |
|--------|-------------|
| `connected` | Active, syncing normally |
| `disconnected` | Credentials invalid or revoked |
| `needs_attention` | Connected but has errors |
| `syncing` | Sync in progress |
| `disabled` | Admin-disabled |
| `archived` | No longer in use |

### Channel Health

| Health | Criteria |
|--------|----------|
| `healthy` | Last sync successful, no errors in 24h |
| `warning` | Minor errors or queue backlog |
| `critical` | Multiple sync failures, connection lost |

---

## 3. Quick Stats

Dashboard-level metrics for all channels:

- Active Channels
- Disconnected Channels
- Channels With Errors
- Products Synced
- Orders Imported Today
- Customers Imported Today
- Pending Sync Jobs
- Failed Sync Jobs

---

## 4. Inventory Mapping

Each Channel configures how inventory is managed:

| Setting | Description |
|---------|-------------|
| Warehouse | Default warehouse for this channel's orders |
| Stock Rules | When to update stock on the channel (on reservation, on dispatch, etc.) |
| Reservation Rules | When to reserve stock (on order creation, on confirmation) |
| Publishing Rules | Which products are published to this channel |
| Synchronization Rules | Direction: ECOS → Channel | Channel → ECOS | Both |

---

## 5. Pricing

Each Channel configures pricing independently:

| Setting | Description |
|---------|-------------|
| Price List | Which ECOS price list to use |
| Discount Rules | Channel-specific discount logic |
| Currency | Channel transaction currency |
| Tax Rules | Tax inclusion/exclusion rules |

---

## 6. Shipping

Each Channel configures shipping independently:

| Setting | Description |
|---------|-------------|
| Shipping Method | Default shipping method |
| Carrier Mapping | Map channel carrier codes to ECOS carriers |
| Shipping Zones | Geographic rules |
| Delivery Rules | Delivery time expectations |

---

## 7. Dispatch Profiles

Channels define how their orders are dispatched from the warehouse.

### Profile Types

| Profile | Description |
|---------|-------------|
| `bulk_distribution` | Products loaded directly without packing (vehicle receives quantities) |
| `pack_during_loading` | Products packed into customer boxes during driver handover |
| `pre_packed` | Orders packed before vehicle arrives |

Dispatch Profiles are defined per channel. New profiles can be added without changing the core planning engine.

---

## 8. Channel Activity

Every Channel has a unified activity feed:

- Sync Events (success, failure, partial)
- Error Log (detailed error messages)
- User Actions (manual sync, configuration change)
- System Events (auto-sync triggered, queue cleared)
- Manual Operations (reconnect, reset, rebuild mapping)

---

## 9. Entity Relationships

```
Channel
├── → Warehouse (default)
├── → PriceList (default)
├── → Team (owner)
├── SyncJobs[]
│   ├── id, type, status, started_at, completed_at, error_message
├── ActivityEvents[]
└── Configuration (JSON per channel type)
    ├── WooCommerce: { url, consumer_key, consumer_secret, webhook_secret }
    ├── Shopify: { shop_domain, access_token }
    └── ...
```

---

## 10. Workspace Layout

```
Page Header: "Channels" + [New Channel] [Sync All] [Import] [Export]
↓
Quick Stats: Active | Disconnected | Errors | Products Synced | Orders Today | ...
↓
Status Tabs: All | Connected | Disconnected | Needs Attention | Syncing | Disabled | Archived
↓
Search + Filters (Type | Warehouse | Owner Team | Last Sync | Has Errors)
↓
Smart Operations: Sync Now | Pause | Resume | Reconnect | View Errors | Retry Failed | More ▼
↓
Channels Table: Logo | Name | Type | Team | Status | Products | Orders | Customers | Last Sync | Health | Actions
↓
Pagination
```

---

## 11. Channel Drawer Tabs

```
General     → Name, type, status, team, logo, settings
Connection  → Credentials, webhook config, connection test
Products    → Product sync config, mapping rules, publishing rules
Orders      → Order import config, status mapping, order rules
Customers   → Customer import config, deduplication rules
Inventory   → Warehouse, stock rules, reservation rules
Pricing     → Price list, currency, tax rules
Shipping    → Carrier mapping, zones, delivery rules
Activity    → Sync events, errors, user actions, system events
Timeline    → Channel lifecycle: created, connected, disconnected, config changes
Logs        → Raw sync log with search and filter
```

---

## 12. Future Improvements

- **Webhook Management** — manage, test, and retry webhooks per channel
- **Sync Scheduler** — visual scheduler to configure sync windows
- **Health Alerts** — push notifications when channel health degrades
- **Channel Cloning** — duplicate a channel configuration to add a similar channel
- **Channel Analytics** — revenue, orders, products per channel over time
- **Multi-Warehouse** — allow different warehouses per order type or product category
