<?php

declare(strict_types=1);

namespace Modules\Marketing\Assets\Domain\Enums;

/**
 * Lifecycle state of a marketing asset in ECOS.
 *
 * Assets are NEVER physically deleted — only transitioned between states.
 * This preserves historical campaign relationships and reporting data.
 *
 * State transition rules:
 *   Any → ACTIVE                    (asset seen again in a sync)
 *   ACTIVE → REMOVED_FROM_PROVIDER  (not seen in latest full sync)
 *   ACTIVE → ACCESS_REVOKED         (permission check confirms access lost)
 *   ACTIVE → DISABLED               (platform reports asset is disabled)
 *   ACTIVE → DISCONNECTED           (parent business disconnected; cascade)
 *   Any → ARCHIVED                  (user-initiated archival in ECOS)
 *   Any → UNKNOWN                   (connector returned unexpected state)
 */
enum AssetLifecycleStatus: string
{
    /** Asset is reachable and healthy. Default state after discovery. */
    case Active = 'active';

    /** Parent entity (e.g. Business) was disconnected; child is unreachable. */
    case Disconnected = 'disconnected';

    /** Our permission tokens no longer grant access to this asset. */
    case AccessRevoked = 'access_revoked';

    /** Asset was deleted or removed on the provider side. */
    case RemovedFromProvider = 'removed_from_provider';

    /** Asset exists but is disabled at the platform level (e.g. ad account suspended). */
    case Disabled = 'disabled';

    /** Manually archived in ECOS; excluded from sync but data preserved. */
    case Archived = 'archived';

    /** Connector returned unexpected or unrecognised state. */
    case Unknown = 'unknown';

    // ── Legacy compat — existing DB rows ────────────────────────────────────
    /** @deprecated Use Disabled */
    case Inactive = 'inactive';

    // ── Helpers ───────────────────────────────────────────────────────────────

    public function isActive(): bool
    {
        return $this === self::Active;
    }

    /** States that should block further synchronisation attempts. */
    public function preventsSync(): bool
    {
        return in_array($this, [
            self::Disabled,
            self::Archived,
            self::RemovedFromProvider,
        ], true);
    }

    /** States that mean the asset is no longer reachable via the provider. */
    public function isUnreachable(): bool
    {
        return in_array($this, [
            self::Disconnected,
            self::AccessRevoked,
            self::RemovedFromProvider,
        ], true);
    }

    /**
     * States that should NOT be ghost-marked during a full sync.
     * Terminal assets are already accounted for; don't double-mark them.
     */
    public function isTerminal(): bool
    {
        return in_array($this, [
            self::RemovedFromProvider,
            self::Archived,
            self::AccessRevoked,
        ], true);
    }

    public function label(): string
    {
        return match ($this) {
            self::Active => 'Active',
            self::Disconnected => 'Disconnected',
            self::AccessRevoked => 'Access Revoked',
            self::RemovedFromProvider => 'Removed from Provider',
            self::Disabled => 'Disabled',
            self::Archived => 'Archived',
            self::Unknown => 'Unknown',
            self::Inactive => 'Inactive (legacy)',
        };
    }

    public function color(): string
    {
        return match ($this) {
            self::Active => 'green',
            self::Disconnected => 'amber',
            self::AccessRevoked => 'red',
            self::RemovedFromProvider => 'red',
            self::Disabled => 'slate',
            self::Archived => 'slate',
            self::Unknown => 'amber',
            self::Inactive => 'slate',
        };
    }
}
