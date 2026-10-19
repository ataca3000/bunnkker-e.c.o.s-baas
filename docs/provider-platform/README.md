# Provider Platform — Architecture Overview

**Module path:** `Modules\Marketing\ProviderPlatform`  
**Registered by:** `ProviderPlatformServiceProvider`  
**Boot order:** must register before `ProviderConfigServiceProvider`

---

## Purpose

The Provider Platform is the infrastructure layer that all Marketing provider integrations (Meta, Google Ads, TikTok, LinkedIn, etc.) sit on. It answers three questions:

1. **What can each provider do?** → `ProviderRegistry` + `ProviderCapabilityEngine`
2. **What happened to each provider?** → `ProviderEventPublisher` + `marketing_provider_events`
3. **How is each provider performing?** → `ProviderMetricsCollector`

No module in the system is allowed to hard-code `if ($provider === 'meta')` checks. All provider dispatch must go through the registry's capability API.

---

## Core Services

### ProviderRegistry

Populated at boot by `ProviderPlatformServiceProvider`. Holds `ProviderDefinition` value objects for every known provider.

```php
$registry->resolve('meta');                         // ProviderDefinition
$registry->findByCapability(ProviderCapability::ADS); // list<ProviderDefinition>
$registry->all();                                   // all registered definitions
```

Currently registered: `meta`, `google_ads`, `tiktok`, `linkedin`, `snapchat`, `x_twitter`

### ProviderCapabilityEngine

Convenience query layer over the registry.

```php
$engine->supports('meta', ProviderCapability::WHATSAPP);      // true
$engine->providersWithCapability(ProviderCapability::COMMERCE); // ['meta']
$engine->anyProviderSupports(ProviderCapability::INSTAGRAM);   // true
$engine->commonCapabilities(['meta', 'google_ads']);           // ['oauth', 'campaigns', 'ads', 'analytics']
```

### ProviderEventPublisher

Central publication point. Inject it anywhere you need to emit a provider lifecycle event.

```php
$publisher->providerConfigured($companyId, 'meta', $actorId);
$publisher->providerHealthChanged($companyId, 'meta', 'token_expired', 'connected', $checks);
$publisher->providerCredentialRotated($companyId, 'meta', $actorId);
```

The publisher:
- Deduplicates within a 3-second window (prevents rapid-fire storms)
- Persists every event to `marketing_provider_events` (audit trail / replay)
- Dispatches through the Laravel event bus (listeners handle async via `ShouldQueue`)
- Never throws — failures are logged, call sites are never affected

**Security invariant:** no factory method accepts or stores secrets, tokens, or credentials. All event payloads are safe for logging.

### ProviderMetricsCollector

Redis-backed counter accumulator (24-hour TTL). Used by the Monitoring OS to build provider health timelines.

```php
$metrics->getMetrics($companyId, 'meta');             // Redis snapshot
$metrics->getEventCounts($companyId, 'meta', days:7); // DB query from events table
```

---

## Event Listeners

Three subscriber classes handle every `AbstractProviderEvent`:

| Listener | Queue | Scope |
|---|---|---|
| `AuditProviderEventListener` | `audit` | Every event → ConfigAuditService |
| `NotifyOnProviderHealthChangeListener` | `notifications` | Health-degraded, token-expired, validation-failed |
| `TrackProviderMetricsListener` | synchronous | All events → Redis counter increment |

---

## Database

### `marketing_provider_events`

Immutable append-only log. Every published event lands here.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Generated at event construction |
| `event_name` | varchar(100) | e.g. `provider.health_changed` |
| `company_id` | UUID | Multi-tenant isolation |
| `provider` | varchar(50) | e.g. `meta` |
| `provider_type` | varchar(50) | e.g. `social_platform` |
| `current_status` | varchar(50) | Status after this event |
| `previous_status` | varchar(50) | Status before this event |
| `triggered_by` | UUID | User ID (nullable for automated events) |
| `correlation_id` | UUID | Cross-service correlation |
| `environment` | varchar(50) | `production`, `staging`, `local` |
| `metadata` | JSON | Event-specific safe payload |
| `occurred_at` | timestamp | When the event happened |

Indexes: `(company_id, provider, occurred_at)`, `(event_name, occurred_at)`

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/marketing/providers` | List all registered providers |
| `GET` | `/api/marketing/providers?capability=ads` | Filter by capability |
| `GET` | `/api/marketing/providers/{provider}/metrics` | Provider metrics snapshot |

---

## Provider Lifecycle (credential layer)

```
validateAndSave() → providerConfigured / providerConfigurationUpdated
validate()        → providerValidated / providerValidationFailed
rotateSecret()    → providerCredentialRotated
clear()           → providerConfigurationDeleted
auditOAuthConnected()    → providerConnected
auditOAuthDisconnected() → providerDisconnected
ProviderHealthMonitor.finalize() → providerHealthChanged (on status transition)
```
