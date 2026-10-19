# Provider Platform — Event Catalog

All events extend `AbstractProviderEvent` and share a standard payload. Events are emitted by `ProviderEventPublisher` — never construct them directly.

---

## Standard Payload (all events)

| Field | Type | Description |
|---|---|---|
| `eventId` | UUID | Unique event ID, generated at construction |
| `eventName` | string | Dot-notation name (see below) |
| `occurredAt` | ISO8601 | When the event occurred |
| `companyId` | UUID | Company scope |
| `provider` | string | Provider key (`meta`, `google_ads`, etc.) |
| `providerType` | string | Category (`social_platform`, `advertising_platform`, etc.) |
| `triggeredBy` | UUID\|null | Actor user ID; null for automated events |
| `currentStatus` | string | Status after this event |
| `previousStatus` | string\|null | Status before this event |
| `correlationId` | UUID\|null | Cross-service trace correlation |
| `requestId` | UUID\|null | HTTP request ID |
| `environment` | string | `production`, `staging`, `local` |
| `metadata` | array | Event-specific payload (never contains secrets) |

**Security invariant:** `app_secret`, `access_token`, `refresh_token`, and any credential value MUST NEVER appear in any event field. All event payloads are safe for logging.

---

## Credential Lifecycle Events

### `provider.configured`
Emitted when a provider's credentials are saved for the first time.

- **Factory:** `$publisher->providerConfigured($companyId, $provider, $actorId)`
- **Trigger:** `ProviderCredentialService::validateAndSave()` (new record)
- **currentStatus:** `ready`
- **previousStatus:** `null`

---

### `provider.configuration_updated`
Emitted when existing credentials are updated (app_id, redirect_uri, etc.).

- **Factory:** `$publisher->providerConfigurationUpdated($companyId, $provider, $actorId, $previousStatus)`
- **Trigger:** `ProviderCredentialService::validateAndSave()` (existing record)
- **currentStatus:** `ready`

---

### `provider.configuration_deleted`
Emitted when a provider's full credential record is removed.

- **Factory:** `$publisher->providerConfigurationDeleted($companyId, $provider, $actorId, $previousStatus)`
- **Trigger:** `ProviderCredentialService::clear()`
- **currentStatus:** `not_configured`

---

### `provider.validated`
Emitted when credentials pass live API validation (without saving).

- **Factory:** `$publisher->providerValidated($companyId, $provider, $actorId, $appId)`
- **Trigger:** `ProviderCredentialService::validate()` (success path)
- **metadata:** `{app_id: string}`

---

### `provider.validation_failed`
Emitted when credentials fail live API validation.

- **Factory:** `$publisher->providerValidationFailed($companyId, $provider, $actorId, $appId, $errors)`
- **Trigger:** `ProviderCredentialService::validate()` (failure path)
- **metadata:** `{app_id: string, errors: list<string>}`

---

### `provider.credential_rotated`
Emitted when the app_secret is rotated (validated new secret replaces old one atomically).

- **Factory:** `$publisher->providerCredentialRotated($companyId, $provider, $actorId)`
- **Trigger:** `ProviderCredentialService::rotateSecret()`
- **metadata:** `{has_app_secret: true}`

---

## OAuth Lifecycle Events

### `provider.connected`
Emitted when OAuth authorization completes and the provider is connected.

- **Factory:** `$publisher->providerConnected($companyId, $provider, $actorId)`
- **Trigger:** `ProviderCredentialService::auditOAuthConnected()`
- **currentStatus:** `connected`
- **previousStatus:** `ready`

---

### `provider.disconnected`
Emitted when a provider's OAuth token is revoked or the user disconnects.

- **Factory:** `$publisher->providerDisconnected($companyId, $provider, $actorId)`
- **Trigger:** `ProviderCredentialService::auditOAuthDisconnected()`
- **currentStatus:** `ready`
- **previousStatus:** `connected`

---

### `provider.token_expired`
Emitted when an OAuth access token expires or is revoked by the provider.

- **Factory:** `$publisher->providerTokenExpired($companyId, $provider, $connectionId?)`
- **Trigger:** connector-level token refresh failure
- **currentStatus:** `token_expired`
- **previousStatus:** `connected`

---

## Health Events

### `provider.health_changed`
Emitted when a health check detects a status transition.

- **Factory:** `$publisher->providerHealthChanged($companyId, $provider, $newStatus, $oldStatus, $checks)`
- **Trigger:** `ProviderHealthMonitor::finalize()` (status transition only)
- **metadata:** `{checks: array}` — boolean results of each check (never includes credential values)

---

## Sync Events

### `provider.sync_started`
- **Factory:** `$publisher->providerSyncStarted($companyId, $provider, $connectionId)`

### `provider.sync_completed`
- **Factory:** `$publisher->providerSyncCompleted($companyId, $provider, $connectionId, $assetsDiscovered, $durationSeconds)`
- **metadata:** `{connection_id, assets_discovered, duration_seconds}`

### `provider.sync_failed`
- **Factory:** `$publisher->providerSyncFailed($companyId, $provider, $connectionId, $reason)`
- **metadata:** `{connection_id, error: string}`

---

## Error Events

### `provider.error_occurred`
General-purpose error event for unexpected provider API failures.

- **Factory:** `$publisher->providerErrorOccurred($companyId, $provider, $currentStatus, $errorClass, $errorMessage)`
- **metadata:** `{error_class, error_message}`

---

## Status Values

| Value | Meaning |
|---|---|
| `not_configured` | No credential record exists |
| `invalid_configuration` | app_id / app_secret fail validation |
| `ready` | Credentials valid, OAuth not yet initiated |
| `connected` | OAuth token present and valid |
| `token_expired` | OAuth access token expired or revoked |
| `permission_error` | Connected but missing required scopes |
| `webhook_missing` | Connected but webhook subscription not registered |
| `sync_disabled` | Integration paused by user |
| `service_unavailable` | Provider API unreachable (network or 5xx) |
| `unknown` | Unexpected error during health check |

---

## Notification Triggers

`NotifyOnProviderHealthChangeListener` fires for:

| Event | Severity | Condition |
|---|---|---|
| `provider.health_changed` | critical | `currentStatus` in `[invalid_configuration, service_unavailable, unknown]` |
| `provider.token_expired` | warning | always |
| `provider.validation_failed` | warning | always |
