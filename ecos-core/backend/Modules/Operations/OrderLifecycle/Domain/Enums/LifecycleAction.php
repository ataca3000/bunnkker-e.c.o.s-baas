<?php

declare(strict_types=1);

namespace Modules\Operations\OrderLifecycle\Domain\Enums;

/**
 * The action the OrderLifecycleCoordinator (or one of its handlers) took for a lifecycle event.
 *
 * Callers branch on this value to understand what happened:
 *
 *   StatusIgnored               — no handler supports this status; no evaluation performed
 *   PolicyRejected              — policy evaluated and returned ineligible (product/order flags)
 *   ManufacturingTriggered      — policy approved + manufacturing executed successfully
 *   ManufacturingBlocked        — policy approved + manufacturing attempted + workflow blocked
 *   ManufacturingNotRequired    — policy approved + FG stock sufficient; no manufacturing needed
 *   ManufacturingAlreadyExecuted — policy found existing transaction; idempotent replay
 *
 * Future actions (planned):
 *   ShippingTriggered, ProcurementTriggered, NotificationSent, ...
 */
enum LifecycleAction: string
{
    case StatusIgnored = 'status_ignored';
    case PolicyRejected = 'policy_rejected';
    case ManufacturingTriggered = 'manufacturing_triggered';
    case ManufacturingBlocked = 'manufacturing_blocked';
    case ManufacturingNotRequired = 'manufacturing_not_required';
    case ManufacturingAlreadyExecuted = 'manufacturing_already_executed';

    public function label(): string
    {
        return match ($this) {
            self::StatusIgnored => 'Status ignored — no evaluation performed',
            self::PolicyRejected => 'Policy rejected — manufacturing not eligible',
            self::ManufacturingTriggered => 'Manufacturing triggered successfully',
            self::ManufacturingBlocked => 'Manufacturing attempted but workflow blocked',
            self::ManufacturingNotRequired => 'Manufacturing not required — sufficient stock on hand',
            self::ManufacturingAlreadyExecuted => 'Manufacturing already completed for this order line',
        };
    }

    /** True when manufacturing is complete (just executed or already done previously). */
    public function isManufacturingComplete(): bool
    {
        return match ($this) {
            self::ManufacturingTriggered, self::ManufacturingAlreadyExecuted => true,
            default => false,
        };
    }

    /** True when the coordinator took no effective action in this invocation. */
    public function isNoOp(): bool
    {
        return match ($this) {
            self::StatusIgnored,
            self::PolicyRejected,
            self::ManufacturingNotRequired,
            self::ManufacturingAlreadyExecuted => true,
            default => false,
        };
    }
}
