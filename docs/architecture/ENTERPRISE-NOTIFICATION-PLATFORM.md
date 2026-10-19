# Enterprise Notification Platform — Specification

**Document:** ENTERPRISE-NOTIFICATION-PLATFORM  
**Service:** EPS-04  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-EPS-ARCH-001  
**Parent:** ENTERPRISE-PLATFORM-SERVICES.md

---

## 1. Mission

> Deliver **unified, policy-driven notifications** based on Business Events and Policies across all channels.

No module sends its own notifications. No notification logic is hardcoded in any module. All notification behavior — what triggers a notification, who receives it, on which channel, with what priority, under what conditions — is governed by the Policy Engine and configured in the Configuration Platform.

---

## 2. Core Principles

1. **Policy-driven** — all notification decisions come from `NotificationPolicy`; never hardcoded
2. **Event-sourced** — most notifications are triggered by Business Events (EPS-01)
3. **Channel-agnostic** — the platform abstracts delivery channels; adding a new channel requires no module changes
4. **Locale-aware** — notifications render in the recipient's preferred language
5. **Rate-limited** — no recipient is flooded; configurable limits per channel per time window
6. **Audited** — every notification attempt (success or failure) is recorded

---

## 3. Notification Entity

```
Notification
├── id                    uuid
├── company_id            → Company
│
├── notification_type     string        — dot-notation key (e.g. "order.confirmed", "shortage.detected")
├── template_id           string        — which notification template to render
│
├── source_type           enum:
│                           event           — triggered by BusinessEvent (EPS-01)
│                           policy          — triggered by Policy Engine decision
│                           decision_engine — triggered by a Decision Engine
│                           ai              — triggered by AI recommendation
│                           manual          — triggered by a user action
│                           scheduled       — triggered by a scheduled job
│                           alert           — triggered by a system alert
│                           exception       — triggered by an operational exception
│
├── source_id             uuid (nullable)   — event_id, recommendation_id, etc.
│
├── recipients[]          → NotificationRecipient[]
├── deliveries[]          → NotificationDelivery[]
│
├── priority              enum: critical | high | normal | low
├── group_key             string (nullable) — for grouping related notifications
│
├── payload               JSONB             — data available to the template
│
├── policy_id             → Policy (nullable) — which policy governed this notification
├── config_version_id     → ConfigurationVersion (nullable)
│
├── created_at            timestamp
└── expires_at            timestamp (nullable) — notifications older than this are not delivered
```

---

## 4. NotificationDelivery Entity

Each notification produces one delivery attempt per channel per recipient.

```
NotificationDelivery
├── id                    uuid
├── notification_id       → Notification
├── recipient_id          → User
├── channel               enum (see Section 6)
│
├── status                enum: pending | sending | delivered | failed | bounced | expired
├── attempt_count         int           — increments on each retry
├── last_attempt_at       timestamp (nullable)
├── delivered_at          timestamp (nullable)
│
├── rendered_subject      string (nullable)   — email subject, notification title
├── rendered_body         text (nullable)     — final rendered message
│
├── provider_message_id   string (nullable)   — ID returned by the delivery provider
├── failure_reason        string (nullable)
│
├── read_at               timestamp (nullable)  — for in-app channel only
└── clicked_at            timestamp (nullable)  — for in-app / email channels
```

---

## 5. Notification Sources

### 5.1 Event-Triggered (primary source)

The Notification Platform subscribes to Business Events (EPS-01). When a subscribed event arrives, it checks the active `NotificationPolicy` to determine:
- Should a notification be sent?
- Who should receive it?
- Which channel?
- What priority?

```
BusinessEvent published
    ↓
NotificationPlatform.onEvent(event)
    ↓
NotificationPolicy.evaluate(event, context)
    ↓
If policy says notify:
    Build Notification
    → Resolve recipients (roles, users, teams)
    → Select channels (from policy + user preferences)
    → Enqueue deliveries
```

### 5.2 Policy-Triggered

Decision Engines and modules call the notification platform directly when they make a decision that requires notification (e.g. partial allocation approval required).

### 5.3 AI-Triggered

AI generates a recommendation → AI publishes `ai.recommendation.generated` event → Notification Platform delivers the recommendation to relevant users based on `AIPolicy.notification_targets`.

### 5.4 Manual

Users can send notifications to other users through the platform (e.g. "assign this order to team member"). Always goes through the platform — no direct messaging outside this service.

### 5.5 Scheduled

Scheduled jobs trigger notifications at specific times (e.g. "Daily operations summary at 07:00", "Overdue payment alert at 09:00"). Configured via scheduled job system + `NotificationPolicy`.

### 5.6 Alert/Exception

Operational exceptions (shortage detected, loading exception, dead letter queue overflow) automatically produce notifications. Severity maps to priority.

---

## 6. Delivery Channels

### 6.1 Channel Registry

| Channel | Code | Use Case |
|---|---|---|
| In-App | `in_app` | Real-time alerts in the ECOS web/mobile application |
| Email | `email` | Formal communications, summaries, reports |
| SMS | `sms` | Critical operational alerts when app is not open |
| WhatsApp | `whatsapp` | WhatsApp Business API; operational updates in Egypt/MENA |
| Push Notification | `push` | Mobile app push (iOS/Android) |
| Webhook | `webhook` | Integration with external systems |
| Future | `*` | Any new channel is added by implementing `ChannelAdapterContract` |

### 6.2 Channel Adapter Contract

```php
interface ChannelAdapterContract
{
    /** The channel code this adapter handles. */
    public function channel(): string;

    /** Deliver a notification. Returns provider message ID on success. */
    public function deliver(NotificationDelivery $delivery): DeliveryResult;

    /** Check delivery status (for channels with async status updates). */
    public function checkStatus(string $providerMessageId): DeliveryStatus;
}
```

Adding a new channel requires only a new `ChannelAdapterContract` implementation — no changes to the notification platform core.

---

## 7. NotificationPolicy

All notification behavior is governed by `NotificationPolicy` from the Policy Engine.

```
NotificationPolicy
├── triggers[]              — which event types + conditions produce a notification
│   ├── event_type          string          — e.g. "preparation.shortage.detected"
│   ├── conditions          JSONB           — additional conditions (e.g. shortage > 10 units)
│   └── notification_type   string          — which notification template to use
│
├── recipient_rules[]       — who receives notifications
│   ├── trigger_type        string          — which trigger this applies to
│   ├── recipient_type      enum: role | user | team | event_actor | manager
│   ├── roles[]             string[]        — which roles receive this (if recipient_type=role)
│   └── include_actor       bool            — include the user who triggered the event
│
├── channel_preferences[]   — which channels per notification type
│   ├── notification_type   string
│   ├── priority_channels[] — ordered list of channels to try
│   └── require_all         bool            — deliver to all channels, not just first successful
│
├── priority_rules[]        — priority based on context
│   ├── condition           JSONB
│   └── priority            enum: critical | high | normal | low
│
├── grouping_rules[]        — group related notifications to avoid flooding
│   ├── notification_type   string
│   ├── group_key_template  string          — e.g. "{event.aggregate_id}_{date}"
│   └── group_window_minutes int            — group window duration
│
├── rate_limits[]           — per channel per time window
│   ├── channel             enum
│   ├── max_per_hour        int
│   └── max_per_day         int
│
├── working_hours           — only deliver non-critical notifications during working hours
│   ├── timezone            string
│   ├── start_hour          int             — 0–23
│   └── end_hour            int
│
├── escalation_rules[]      — escalate if not acknowledged within N minutes
│   ├── notification_type   string
│   ├── escalate_after_minutes int
│   └── escalate_to_role    string
│
└── retry_policy            — retry failed deliveries
    ├── max_attempts         int
    ├── backoff_seconds[]    int[]           — wait times between retries
    └── dead_letter_after    int             — move to dead letter after N failed attempts
```

---

## 8. Notification Templates

Notification content is rendered from templates. Templates support:
- Localization (template per locale)
- Variable interpolation from `Notification.payload`
- Rich text (for email/in-app channels)
- Plain text (for SMS/WhatsApp)

```
NotificationTemplate
├── id                    uuid
├── notification_type     string
├── channel               enum
├── locale                string        — e.g. "en", "ar"
├── subject               string (nullable)   — email/push title
├── body_template         text          — Twig/Blade template with {{ payload.field }} interpolation
└── is_active             bool
```

Templates are managed in the Configuration Platform and versioned.

---

## 9. User Notification Preferences

Individual users may override channel preferences (within limits set by `NotificationPolicy`):

```
UserNotificationPreference
├── user_id               → User
├── notification_type     string        — which notification type
├── preferred_channels[]  enum[]        — user's preferred channels
├── muted                 bool          — temporarily mute this notification type
├── muted_until           timestamp (nullable)
└── updated_at            timestamp
```

Policy sets the floor. Users may reduce channels, not add channels that the policy doesn't permit.

---

## 10. Notification Lifecycle

```
Trigger received (Event / Policy / AI / Manual / Scheduled / Alert)
        ↓
NotificationPolicy evaluated
  → Is this trigger enabled? If not: discard
  → Resolve recipients
  → Determine channels (policy + user preferences)
  → Check rate limits
  → Check working hours (for non-critical)
  → Check grouping (group with recent notifications?)
        ↓
Notification record created
        ↓
For each recipient × channel:
  NotificationDelivery created (status: pending)
        ↓
Delivery queue processed:
  ChannelAdapter.deliver() called
  → Success: status = delivered; delivered_at = now
  → Failure: status = failed; retry scheduled (per retry_policy)
  → Retry exhausted: status = dead_letter; escalation triggered (if configured)
```

---

## 11. Localization

All notifications render in the recipient's preferred locale:

1. Resolve recipient's preferred locale (from `users.locale` setting)
2. Look up `NotificationTemplate` for (notification_type, channel, locale)
3. If not found: fall back to `en` (default)
4. Render template with payload data

All Arabic-market templates must be RTL-aware. The `locale` field on templates follows BCP-47 (`en`, `ar`, `ar-EG`, etc.).

---

## 12. Configuration Platform Dependency

### Policy Consumed: `NotificationPolicy`

```php
$policy = $policyEngine->resolve(NotificationPolicy::class, 'company', $companyId);
$result = $ruleEngine->evaluate($policy, [
    'event_type'   => $event->event_type,
    'aggregate'    => $event->aggregate_type,
    'payload'      => $event->payload,
], 'notification_trigger');
// Returns: { decision: { should_notify: true, recipients: [...], channels: [...], priority: "high" }, ... }
```

### Configuration Settings

| Setting Key | Description |
|---|---|
| `notifications.enabled` | Global notification switch |
| `notifications.channels.email.enabled` | Enable email delivery |
| `notifications.channels.sms.enabled` | Enable SMS delivery |
| `notifications.channels.whatsapp.enabled` | Enable WhatsApp delivery |
| `notifications.channels.email.provider` | Email provider (SES, Mailgun, Postmark, etc.) |
| `notifications.channels.sms.provider` | SMS provider (Twilio, Vonage, etc.) |
| `notifications.rate_limits.default_per_hour` | Default hourly limit per user per channel |
| `notifications.working_hours.enabled` | Enforce working hours for non-critical |
| `notifications.templates.default_locale` | Default template locale |

### Feature Flags

```
modules.notification_platform       — must be enabled
modules.notification_platform.email — email channel enabled
modules.notification_platform.sms   — SMS channel enabled
modules.notification_platform.whatsapp — WhatsApp channel enabled
modules.notification_platform.push  — push notifications enabled
modules.notification_platform.webhook — webhook channel enabled
```

### Audit

Every `NotificationDelivery` attempt (success and failure) is recorded. Audit includes:
- `notification_id`, `recipient_id`, `channel`, `status`
- `policy_id` and `config_version_id` from the governing `NotificationPolicy`
- Rendered body (for compliance-relevant channels like email)

---

## 13. DDD Module Structure

```
Modules/
└── Core/
    └── EnterpriseServices/
        └── NotificationPlatform/
            ├── Domain/
            │   ├── Models/
            │   │   ├── Notification.php
            │   │   ├── NotificationDelivery.php
            │   │   ├── NotificationTemplate.php
            │   │   └── UserNotificationPreference.php
            │   ├── Enums/
            │   │   ├── NotificationChannel.php
            │   │   ├── NotificationPriority.php
            │   │   └── DeliveryStatus.php
            │   ├── ValueObjects/
            │   │   └── DeliveryResult.php
            │   └── Contracts/
            │       └── ChannelAdapterContract.php
            ├── Application/
            │   ├── Services/
            │   │   ├── TriggerNotificationService.php
            │   │   ├── DeliverNotificationService.php
            │   │   ├── RetryDeliveryService.php
            │   │   └── RenderTemplateService.php
            │   └── Listeners/
            │       └── EventToNotificationListener.php
            └── Infrastructure/
                └── Adapters/
                    ├── InAppChannelAdapter.php
                    ├── EmailChannelAdapter.php
                    ├── SmsChannelAdapter.php
                    ├── WhatsAppChannelAdapter.php
                    └── WebhookChannelAdapter.php
```
