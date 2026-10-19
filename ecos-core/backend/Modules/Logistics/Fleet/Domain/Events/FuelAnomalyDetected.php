<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Fleet\Domain\Models\FuelTransaction;

/**
 * A purchase fell outside expected bounds. A SIGNAL, not a rejection.
 */
class FuelAnomalyDetected
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly FuelTransaction $transaction,
        public readonly ?string $actor = null,
    ) {}
}
