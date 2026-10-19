# Service Contracts

**Document:** SERVICE-CONTRACTS  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-CONTRACT-ARCH-001  
**Parent:** ENTERPRISE-CONTRACTS.md

---

## 1. Service Contract Schema

Service Contracts define the interface of shared enterprise services — the Platform layer services consumed by all Business OS modules.

```
Service Name:       [PascalCase]
Version:            v1
Owner:              [Module / Platform layer]
Consumers:          [All modules that may call this service]
Purpose:            [What this service does at business level]
Interface:          [Operations exposed + their signatures]
SLA:
  availability:     [% uptime expectation]
  latency_p50:      [50th percentile latency]
  latency_p99:      [99th percentile latency]
Failure Behaviour:  [What happens when the service is unavailable]
Version Policy:     [How versions are managed]
Dependencies:       [Other services this service consumes]
Governance:         [Which GOV rule applies]
```

---

## 2. EPS Service Contracts

### SVC-EPS-01: EventPublisherService
```
Version:        v1
Owner:          EPS-01 (Platform)
Consumers:      Every module that emits domain events
Purpose:        Publish a business event to the enterprise event bus
Interface:
  publish(event: BusinessEvent): void
    event.event_id:         UUID (required — caller generates)
    event.event_type:       string (required — e.g. "orders.order.confirmed")
    event.event_version:    string (required — e.g. "v1")
    event.aggregate_type:   string (required)
    event.aggregate_id:     UUID (required)
    event.company_id:       UUID (required)
    event.occurred_at:      datetime (required)
    event.triggered_by:     UUID (required)
    event.triggered_by_type: string (required)
    event.correlation_id:   UUID (optional)
    event.causation_id:     UUID (optional)
    event.source_module:    string (required)
    event.payload:          JSONB (required)
  
  publishBatch(events: BusinessEvent[]): void
    — publish multiple events atomically within a transaction boundary
SLA:
  availability:   99.9%
  latency_p50:    < 10ms
  latency_p99:    < 50ms
Failure Behaviour: Events are queued locally (outbox pattern); delivery guaranteed at-least-once
Governance:     GOV-011
```

### SVC-EPS-02: TimelineService
```
Version:        v1
Owner:          EPS-02 (Platform)
Consumers:      All modules + EPS-01 (auto-generates from events)
Purpose:        Record and retrieve chronological history for business objects
Interface:
  addEntry(entry: TimelineEntryData): TimelineEntry
    entry.object_type:    string (required)
    entry.object_id:      UUID (required)
    entry.entry_type:     enum (required — see TIMELINE-UX-STANDARD.md)
    entry.actor_id:       UUID (optional — system entries have null)
    entry.actor_type:     string (required)
    entry.occurred_at:    datetime (required)
    entry.content:        JSONB (required)
    entry.source_event_id: UUID (optional)
  
  getTimeline(objectType: string, objectId: UUID, filters?): PaginatedResult<TimelineEntry>
  
  addComment(objectType, objectId, actorId, text): TimelineEntry
  
  editComment(entryId, actorId, newText): TimelineEntry
    — only editable entry type
SLA:
  availability:   99.9%
  latency_p50:    < 20ms (write), < 100ms (read)
  latency_p99:    < 100ms (write), < 300ms (read)
Failure Behaviour: Write failures are queued via outbox; reads degrade gracefully (empty timeline, not error)
Governance:     GOV-012
```

### SVC-EPS-03: DocumentService
```
Version:        v1
Owner:          EPS-03 (Platform)
Consumers:      All modules that need file storage
Purpose:        Store, version, and serve documents attached to business objects
Interface:
  initiateUpload(params: UploadParams): UploadSession
    params.object_type, params.object_id, params.display_name, params.category, params.mime_type, params.size_bytes
  
  confirmUpload(sessionId, storageReference): Document
  
  attachExisting(documentId, objectType, objectId): DocumentRelationship
  
  getDocuments(objectType, objectId, filters?): PaginatedResult<Document>
  
  getDownloadUrl(documentId): SignedUrl (expires in 15 min)
  
  addVersion(documentId, newStorageReference): DocumentVersion
  
  quarantine(documentId, reason): void
    — called by virus scanner; sets status = quarantined
SLA:
  availability:   99.9%
  latency_p50:    < 50ms (metadata ops); upload/download via CDN
  latency_p99:    < 200ms (metadata ops)
Failure Behaviour: Upload failures return clear error; existing documents always accessible
Governance:     GOV-013
```

### SVC-EPS-04: NotificationService
```
Version:        v1
Owner:          EPS-04 (Platform)
Consumers:      EPS-01 (event-driven dispatch), any module needing notifications
Purpose:        Deliver notifications across channels according to policies
Interface:
  notify(params: NotificationParams): Notification
    params.notification_type:   string (must match NotificationPolicy)
    params.recipient_ids:       UUID[]
    params.channels:            enum[] [in_app | email | sms | whatsapp | push]
    params.payload:             JSONB
    params.priority:            enum
    params.policy_id:           UUID
    params.source_event_id:     UUID (optional — deduplication)
  
  markRead(notificationId, recipientId): void
  
  dismiss(notificationId, recipientId): void
  
  getInbox(recipientId, filters, pagination): PaginatedResult<Notification>
  
  updateDeliveryPreferences(recipientId, prefs): void
SLA:
  availability:   99.9%
  latency_p50 (in-app): < 100ms
  latency_p50 (email):  < 5s
  latency_p50 (SMS/WhatsApp): < 10s
Failure Behaviour: In-app always attempted first; channel failures logged; EPS-04 never crashes the caller
Governance:     GOV-014
```

---

## 3. Configuration & Policy Service Contracts

### SVC-CFG-001: ConfigurationService
```
Version:        v1
Owner:          Configuration Platform
Consumers:      Every module, every Decision Engine, every Policy evaluation
Purpose:        Resolve configuration values for any scope (Company → Branch → Warehouse → Channel)
Interface:
  get(key: string, context: ScopeContext): ConfigValue
    context.company_id:   UUID (required)
    context.branch_id:    UUID (optional)
    context.warehouse_id: UUID (optional)
    context.channel_id:   UUID (optional)
    — returns most-specific matching config value with inheritance resolution
  
  getMany(keys: string[], context): Map<string, ConfigValue>
  
  set(key, value, scope, scopeId, actorId): ConfigAuditRecord
    — creates a new Config Version; never mutates existing
SLA:
  availability:   99.99% (configuration is critical path for every request)
  latency_p50:    < 5ms (cached)
  latency_p99:    < 20ms
Failure Behaviour: Falls back to Company-scope or defaults; never returns null for mandatory keys
Governance:     GOV-001 to GOV-010 (Configuration Platform)
```

### SVC-CFG-002: PolicyService
```
Version:        v1
Owner:          Configuration Platform (Policy Engine)
Consumers:      Every Command handler (for invariant evaluation), Decision Engines
Purpose:        Evaluate a policy rule for a given context and return allow/deny + parameters
Interface:
  evaluate(policyType: string, context: PolicyContext): PolicyDecision
    decision.allowed:     boolean
    decision.parameters:  JSONB (policy configuration values)
    decision.reason:      string (human-readable if denied)
    decision.policy_id:   UUID
    decision.version:     integer
  
  evaluateMany(rules: [{policyType, context}]): PolicyDecision[]
SLA:
  availability:   99.99%
  latency_p50:    < 10ms (cached)
  latency_p99:    < 30ms
Failure Behaviour: Fail-safe mode: deny by default if unavailable; logs policy evaluation failure
```

### SVC-CFG-003: FeatureFlagService
```
Version:        v1
Owner:          Configuration Platform (Feature Management)
Consumers:      All modules and UI
Purpose:        Check if a feature is enabled for a given company / user
Interface:
  isEnabled(featureKey: string, context: {company_id, user_id?}): boolean
  
  getVariant(featureKey: string, context): string | null
    — for A/B testing variants
SLA:
  latency_p50:    < 2ms (in-memory cache)
  latency_p99:    < 10ms
Failure Behaviour: Feature flags default to OFF; service unavailability never breaks core flows
```

---

## 4. AI Platform Service Contract

### SVC-AI-001: AIService
```
Version:        v1
Owner:          AI Platform
Consumers:      All modules (via event subscriptions), User-facing AI panels
Purpose:        Generate, retrieve, and manage AI recommendations
Interface:
  generateRecommendation(request: RecommendationRequest): AIRecommendation
    request.object_type, request.object_id, request.recommendation_type, request.context
    — async: returns job_id; fires platform.ai.recommendation_generated event when ready
  
  getRecommendations(objectType, objectId, status?): AIRecommendation[]
  
  dismiss(recommendationId, actorId, feedback?): void
  
  confirmAction(recommendationId, actorId): void
    — user accepted and acted on recommendation; signals quality feedback
  
  getConfidenceThreshold(recommendationType): float
    — returns current minimum confidence for displaying this recommendation type
SLA:
  availability:   99%
  latency_p50 (sync):  < 500ms
  latency_p50 (async): varies by model; event fires when complete
Failure Behaviour: Recommendation failures are silent to users; never block core business flows
Governance:     GOV-015
```

---

## 5. Identity Platform Service Contract

### SVC-IDN-001: IdentityService
```
Version:        v1
Owner:          Identity Platform
Consumers:      Every module (authorization checks), API Gateway
Purpose:        Verify identity, resolve permissions, and enforce company isolation
Interface:
  getCurrentUser(token: string): AuthenticatedUser
    user.id, user.company_id, user.branch_id, user.warehouse_id, user.roles, user.permissions
  
  can(userId, permission: string, context?): boolean
  
  getCompanyContext(userId): CompanyContext
    — returns the scoped context to apply company_id isolation
SLA:
  availability:   99.99%
  latency_p50:    < 5ms (cached via request lifecycle)
  latency_p99:    < 20ms
Failure Behaviour: No token / invalid token = 401; unavailable = 503 (never grant access on failure)
```

---

## 6. Audit Service Contract

### SVC-AUD-001: AuditService
```
Version:        v1
Owner:          Platform (Audit)
Consumers:      EPS-01 (all events are immutable audit records), ConfigurationService, PolicyService
Purpose:        Maintain an immutable, tamper-evident audit log of every significant action
Interface:
  record(entry: AuditEntry): void
    entry.actor_id, entry.actor_type, entry.action, entry.object_type, entry.object_id,
    entry.company_id, entry.occurred_at, entry.before, entry.after, entry.ip, entry.source
  
  query(filters): PaginatedResult<AuditEntry>
    — for compliance reporting only; never used in business logic
SLA:
  availability:   99.9%
  latency_p50:    < 20ms (write)
Failure Behaviour: Audit failures are logged as critical alerts; never silently dropped
Retention:      7 years minimum; 10 years for financial actions
```

---

## 7. Localization Service Contract

### SVC-LOC-001: LocalizationService
```
Version:        v1
Owner:          Platform
Consumers:      All modules (EPS-04 notifications), UI rendering layer
Purpose:        Translate UI strings and format numbers, dates, currencies for the user's locale
Interface:
  translate(key: string, locale: string, params?: object): string
  
  formatMoney(amount: Money, locale: string): string
  
  formatDate(date: datetime, locale: string, format?: string): string
  
  formatQuantity(qty: Quantity, locale: string): string
SLA:
  latency_p50:    < 1ms (in-memory)
Failure Behaviour: Returns key path as fallback string; never throws on missing translation
```
