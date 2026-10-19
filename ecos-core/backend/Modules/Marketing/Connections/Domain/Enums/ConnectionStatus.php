<?php

declare(strict_types=1);

namespace Modules\Marketing\Connections\Domain\Enums;

/**
 * Full connection lifecycle status.
 *
 * Every state transition is audited in marketing_connection_audit_logs.
 *
 * State machine:
 *  (new) → Pending → Authenticating → Connected → Validating → Healthy
 *                                                              → Warning
 *                                                              → Degraded
 *  Any   → Disconnected
 *  Healthy|Warning|Degraded → Synchronizing → (returns to previous)
 *  Any   → Archived  (terminal)
 *
 * Legacy values (active, expired, error) are preserved for backward compat
 * with existing DB rows written before the lifecycle state machine was added.
 */
enum ConnectionStatus: string
{
    // ── Lifecycle states ──────────────────────────────────────────────────────

    /** Connection record created, OAuth not yet started. */
    case Pending = 'pending';

    /** User redirected to OAuth; awaiting callback. */
    case Authenticating = 'authenticating';

    /** Token received; not yet validated. */
    case Connected = 'connected';

    /** Validating scopes + permissions. */
    case Validating = 'validating';

    /** A sync job is currently running. */
    case Synchronizing = 'synchronizing';

    /** Fully operational — all permissions valid, API reachable. */
    case Healthy = 'healthy';

    /** Operational with degraded permissions or near rate-limit. */
    case Warning = 'warning';

    /** Serious issue — API errors, missing critical permissions. */
    case Degraded = 'degraded';

    /** Token revoked or user disconnected. */
    case Disconnected = 'disconnected';

    /** Permanently retired — no further action expected. */
    case Archived = 'archived';

    // ── Legacy values — backward-compat ──────────────────────────────────────
    // @deprecated  New connections use the lifecycle states above.

    /** @deprecated Use Healthy */
    case Active = 'active';

    /** @deprecated Use Degraded (token) or Disconnected */
    case Expired = 'expired';

    /** @deprecated Use Degraded */
    case Error = 'error';

    // ── Helpers ───────────────────────────────────────────────────────────────

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Pending',
            self::Authenticating => 'Authenticating',
            self::Connected => 'Connected',
            self::Validating => 'Validating',
            self::Synchronizing => 'Synchronizing',
            self::Healthy => 'Healthy',
            self::Warning => 'Warning',
            self::Degraded => 'Degraded',
            self::Disconnected => 'Disconnected',
            self::Archived => 'Archived',
            self::Active => 'Active',
            self::Expired => 'Expired',
            self::Error => 'Error',
        };
    }

    /** Whether the connection can be used for sync / API calls. */
    public function isUsable(): bool
    {
        return in_array($this, [
            self::Healthy,
            self::Warning,
            self::Degraded,   // degraded = still works, but needs attention
            self::Synchronizing,
            // Legacy
            self::Active,
        ], true);
    }

    public function isActive(): bool
    {
        return $this->isUsable();
    }

    public function isTerminal(): bool
    {
        return in_array($this, [self::Disconnected, self::Archived], true);
    }

    /**
     * Valid next states for the lifecycle state machine.
     *
     * @return list<self>
     */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Pending => [self::Authenticating, self::Disconnected],
            self::Authenticating => [self::Connected, self::Disconnected, self::Error],
            self::Connected => [self::Validating, self::Healthy, self::Disconnected],
            self::Validating => [self::Healthy, self::Warning, self::Degraded, self::Disconnected],
            self::Healthy => [self::Synchronizing, self::Warning, self::Degraded, self::Disconnected, self::Archived],
            self::Warning => [self::Synchronizing, self::Healthy, self::Degraded, self::Disconnected, self::Archived],
            self::Degraded => [self::Synchronizing, self::Healthy, self::Warning, self::Disconnected, self::Archived],
            self::Synchronizing => [self::Healthy, self::Warning, self::Degraded, self::Disconnected],
            self::Disconnected => [self::Pending, self::Archived],
            self::Archived => [],
            // Legacy — can transition to any lifecycle state
            self::Active => [self::Healthy, self::Warning, self::Degraded, self::Disconnected, self::Synchronizing],
            self::Expired => [self::Pending, self::Disconnected, self::Degraded, self::Archived],
            self::Error => [self::Pending, self::Disconnected, self::Degraded, self::Archived],
        };
    }

    public function canTransitionTo(self $next): bool
    {
        return in_array($next, $this->allowedTransitions(), true);
    }
}
