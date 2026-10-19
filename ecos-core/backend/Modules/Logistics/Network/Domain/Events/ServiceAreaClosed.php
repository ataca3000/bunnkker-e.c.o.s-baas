<?php

declare(strict_types=1);

namespace Modules\Logistics\Network\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Network\Domain\Models\ServiceArea;

/**
 * A service area was closed.
 */
class ServiceAreaClosed
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly ServiceArea $area,
        public readonly ?string $actor = null,
    ) {}
}
