<?php

declare(strict_types=1);

namespace Modules\CostManagement\Domain\Enums;

/**
 * Enterprise cost valuation strategies.
 *
 * Official policy (EPIC-DATA-CONSOLIDATION-001, Phase C):
 *   FIFO is the canonical inventory valuation strategy.
 *   Average and Standard remain supported but are NOT the enterprise default.
 */
enum CostStrategy: string
{
    case Fifo = 'fifo';
    case Average = 'average';
    case Standard = 'standard';

    /** The single enterprise-default valuation strategy. */
    public static function canonical(): self
    {
        return self::Fifo;
    }

    public function label(): string
    {
        return match ($this) {
            self::Fifo => 'FIFO (canonical)',
            self::Average => 'Weighted Average',
            self::Standard => 'Standard Cost',
        };
    }
}
