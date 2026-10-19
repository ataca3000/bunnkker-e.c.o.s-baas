<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Domain\Enums;

/**
 * Manufacturing state for a single order line.
 *
 * Lifecycle:
 *   null          → not yet evaluated (line was created before prepare was called)
 *   not_required  → manufacturing was blocked with 'manufacturing_not_needed'
 *                   (sufficient finished goods in stock)
 *   skipped       → policy rejected (product cannot manufacture, no recipe, etc.)
 *   executed      → manufacturing triggered and completed successfully
 *   failed        → workflow was blocked by a domain engine (not enough components,
 *                   decision rejected, etc.); retry is allowed
 *
 * States not used in the synchronous prepare flow (reserved for future async use):
 *   pending       → queued but not yet started
 *   planned       → workflow produced a plan but execution is deferred
 *
 * Check isTerminal() to know whether retry would change anything.
 * Check isSuccessful() to know whether manufactured goods are in inventory.
 */
enum OrderLineManufacturingState: string
{
    case NotRequired = 'not_required';
    case Pending = 'pending';
    case Planned = 'planned';
    case Executed = 'executed';
    case Skipped = 'skipped';
    case Failed = 'failed';

    public function label(): string
    {
        return match ($this) {
            self::NotRequired => 'Not Required',
            self::Pending => 'Pending',
            self::Planned => 'Planned',
            self::Executed => 'Executed',
            self::Skipped => 'Skipped',
            self::Failed => 'Failed',
        };
    }

    /** True when retrying will never change the outcome. */
    public function isTerminal(): bool
    {
        return match ($this) {
            self::Executed, self::Skipped, self::NotRequired => true,
            default => false,
        };
    }

    /** True when manufacturing goods are confirmed in inventory. */
    public function isSuccessful(): bool
    {
        return $this === self::Executed;
    }
}
