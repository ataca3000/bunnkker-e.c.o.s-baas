<?php

declare(strict_types=1);

namespace Modules\Finance\Vat\Domain\Enums;

/**
 * A VAT period's lifecycle: open → return_generated (figures snapshotted) →
 * settled (settlement journal posted). Settlement is terminal.
 */
enum VatPeriodStatus: string
{
    case Open = 'open';
    case ReturnGenerated = 'return_generated';
    case Settled = 'settled';

    public function isSettled(): bool
    {
        return $this === self::Settled;
    }
}
