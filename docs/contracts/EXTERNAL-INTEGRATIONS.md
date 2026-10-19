# External Integrations

**Document:** EXTERNAL-INTEGRATIONS  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-CONTRACT-ARCH-001  
**Parent:** ENTERPRISE-CONTRACTS.md

---

## 1. Purpose

This document defines the operational patterns for all external system integrations: how ECOS authenticates to external services, how data is synchronized, how failures are handled, how webhooks are processed, and how conflicts are resolved.

All translation logic lives in ANTI-CORRUPTION-LAYER.md. This document covers the engineering and operational patterns.

---

## 2. Authentication Patterns

### Pattern A: API Key Authentication
Used by: WooCommerce, Bosta, Fawry, Paymob

```
Key Storage:    Encrypted at rest (ConfigurationPlatform, scope = Channel or Company)
Key Rotation:   Supported via Configuration Platform; new key active immediately; old key valid for 24h overlap
Headers:        Authorization: Bearer {key} or X-API-Key: {key} (provider-specific)
Environment:    Separate keys per environment (production / staging / sandbox)
Never:          API keys never appear in logs, error messages, or event payloads
```

### Pattern B: OAuth 2.0
Used by: Meta (Business API), Stripe

```
Flow:           Authorization Code (for user-granted) or Client Credentials (for server-to-server)
Token Storage:  Encrypted; stored with company_id scope in ConfigurationPlatform
Token Refresh:  Automatic before expiry (15-minute preemptive refresh)
Scopes:         Minimum required scopes only; no over-permissioning
Revocation:     Token revoke + re-auth flow available via Configuration OS
```

### Pattern C: Webhook Signature Verification
Used by: All webhook-sending providers

```
Mechanism:      HMAC-SHA256 signature in request header (provider-specific header name)
Verification:   Compute HMAC of raw request body; compare to header value
Timing:         Constant-time comparison to prevent timing attacks
Rejection:      Invalid signature → 401; log with source IP; do not process payload
Tolerance:      ±300s timestamp window (replay attack protection)
```

---

## 3. Synchronization Patterns

### Pattern S1: Scheduled Pull (Polling)
Used by: WooCommerce orders (primary), Meta orders

```
Schedule:         Every 5 minutes (configurable per store per ChannelPolicy)
Cursor strategy:  Pull orders modified_since last_sync_cursor (stored per channel)
Deduplication:    External reference check before creating ECOS entities
Failure:          Log failed pull; retry next cycle; alert if N consecutive failures
Concurrency:      Per-store distributed lock prevents overlapping pull jobs
```

### Pattern S2: Webhook-First with Polling Fallback
Used by: WooCommerce (preferred), Bosta, Payment Gateways

```
Primary:          Webhook delivery (real-time)
Fallback:         Scheduled poll fills gaps if webhooks are missed
Reconciliation:   Hourly job compares ECOS state with external state for drift detection
Webhook receipt:  Accept → queue → process asynchronously (never synchronous processing in webhook handler)
```

### Pattern S3: Batch Push
Used by: Meta Catalog feed, WooCommerce stock/price updates

```
Aggregation:      Collect changes in a staging buffer for up to 60 seconds
Batch size:       Max 100 items per batch API call
Order:            Ordered by change timestamp; price before stock
Failure:          Failed batch items are retried individually before dead-lettering
Throttle:         Respect provider rate limits; adaptive throttling based on 429 responses
```

---

## 4. Retry Policy

All external HTTP calls follow this retry policy unless overridden by the integration spec:

```
Initial delay:    500ms
Multiplier:       2× exponential backoff
Max delay:        30 seconds per attempt
Max attempts:     5
Jitter:           ±20% random jitter on each delay
Retry conditions: 429 (Too Many Requests), 502, 503, 504, network timeout
No retry:         400, 401, 403, 404, 422 (caller errors — fix before retrying)
```

### Rate Limit Handling (429)
```
Read Retry-After header; wait exactly that duration before retrying
If no Retry-After: use exponential backoff
Track provider-specific rate limit windows; pre-emptively slow down as approaching limit
Alert when rate limit hit more than N times per hour (configurable per ChannelPolicy)
```

---

## 5. Webhook Processing Architecture

### Inbound Webhook Flow
```
1. RECEIVE
   - Accept webhook at dedicated endpoint (no auth required — signature handles security)
   - Verify signature immediately (401 if invalid)
   - Return 200 OK immediately (within 2 seconds, before any processing)

2. QUEUE
   - Enqueue raw payload to dedicated webhook queue (Redis/database)
   - Include: provider, event_type, received_at, raw_body, headers

3. PROCESS (async)
   - Worker dequeues; passes raw payload to provider ACL
   - ACL validates, translates, enriches
   - ACL produces a domain Command or triggers a domain event
   - Deduplication check before dispatching command

4. AUDIT
   - Every processed webhook logged: provider, type, external_id, ECOS entity affected, outcome

5. FAILURE
   - Processing failure: dead-letter queue; alert; manual review UI in ops tooling
   - ACL translation failure: quarantine; log validation errors
```

---

## 6. Conflict Resolution

When ECOS state and external system state diverge:

### Order Status Conflicts
```
Rule:           ECOS is the source of truth for order status
Resolution:     If external system reports a status ECOS doesn't recognize, log + alert; no state change
Exception:      If WooCommerce order is manually cancelled externally (and ECOS hasn't started prep),
                accept cancellation → CancelOrder command
Never:          External system never overrides an ECOS-delivered order back to in_progress
```

### Stock Conflicts
```
Rule:           ECOS Inventory is the source of truth for stock levels
Resolution:     WooCommerce stock = computed from ECOS Inventory (push-only, never pull)
If WooCommerce stock drifts: scheduled reconciliation job pushes correct value
```

### Price Conflicts
```
Rule:           ECOS Pricing Engine is the source of truth
Resolution:     WooCommerce prices = pushed from ECOS channel pricing (never pulled)
```

---

## 7. Error Handling and Dead-Letter

### Dead-Letter Queue
```
Triggers:       Message exceeds max retries; ACL translation failure; unrecognized payload
Storage:        Dedicated dead-letter table per provider; entries never auto-deleted
Alert:          Any dead-letter entry triggers a medium-priority EPS-04 notification to ops team
Review:         Dead-letter entries are visible in the Operations Command Center
Replay:         Authorized ops user can replay a dead-letter entry after investigating root cause
Purge:          Manual purge only; retained for 30 days minimum
```

### Circuit Breaker
```
Open conditions:    5 consecutive failures to reach an external provider within 60 seconds
Open behavior:      Stop attempting; queue messages for replay; alert operations team
Half-open:          After 5 minutes, attempt one probe request
Close conditions:   Probe succeeds; normal processing resumes; queued messages replayed
Circuit state:      Visible in Operations Command Center as integration health indicator
```

---

## 8. Audit Requirements

Every external integration action is audited:

| Action | Audit Record |
|---|---|
| Inbound data received | provider, event_type, external_id, received_at, validation_result |
| Domain entity created from external data | entity_type, entity_id, external_reference, translator_version |
| Outbound data sent | provider, operation, entity_id, sent_at, response_status |
| Webhook signature failure | provider, source_ip, received_at, reason |
| Dead-letter | provider, payload_hash, failure_reason, retry_count |
| Circuit breaker open/close | provider, occurred_at, failure_count, resolution |

Audit records: stored in AuditService (SVC-AUD-001); retained per financial audit requirements.

---

## 9. Versioning and Breaking Changes in External APIs

When an external provider releases a breaking API change:

```
1. Discovery:   Monitor provider changelog; subscribe to provider API versioning announcements
2. Impact:      Assess which ACL translators are affected
3. New ACL:     Create v2 translator alongside v1 (parallel operation)
4. Migration:   Switch to v2 translator per channel (configurable in ChannelPolicy)
5. Deprecate:   Remove v1 translator after all channels migrated
```

Provider-versioned API URLs:
```
WooCommerce:  /wp-json/wc/v3/  (version pinned; tested before upgrade)
Meta:         Graph API v{N}    (minimum supported version tracked in ChannelPolicy)
Bosta:        /v2/             (version pinned)
Stripe:       API Version header (pinned in Stripe dashboard; tested before upgrade)
```

---

## 10. Monitoring and Observability

### Per-Integration Metrics
```
success_rate:           % of requests/webhooks processed successfully (target > 99%)
avg_latency_ms:         Average time from receive to processed
dead_letter_count:      Count of messages in dead-letter queue
circuit_breaker_state:  open | half-open | closed
last_successful_sync:   datetime (for scheduled pull integrations)
rate_limit_hits_per_hour: Count of 429 responses
```

### Alerting Thresholds
```
success_rate < 95%:       Medium alert to ops team
success_rate < 90%:       High alert + circuit breaker evaluation
dead_letter_count > 0:    Medium alert (immediate review)
circuit_breaker opens:    High alert
last_sync > 2× schedule:  Low alert (sync appears stalled)
```
