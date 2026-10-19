<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Fleet\Domain\Models\FuelTransaction;

/**
 * A fuel purchase entered the system.
 */
class FuelTransactionRecorded
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly FuelTransaction $transaction,
        public readonly ?string $actor = null,
    ) {}
}
