<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Fleet\Domain\Models\OdometerReading;

/**
 * A reading below the current accepted value was refused.
 */
class OdometerRolledBack
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly OdometerReading $reading,
        public readonly ?string $actor = null,
    ) {}
}
