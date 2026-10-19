<?php

declare(strict_types=1);

namespace Modules\Logistics\Carriers\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Carriers\Domain\Models\CarrierAccount;

/**
 * A carrier account passed its connection test.
 */
class CarrierAccountConnected
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly CarrierAccount $account,
        public readonly ?string $actor = null,
    ) {}
}
