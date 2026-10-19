<?php

declare(strict_types=1);

namespace Modules\Logistics\Vehicles\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Vehicles\Domain\Models\Vehicle;
use Modules\Logistics\Vehicles\Domain\Models\VehicleDocument;

class VehicleDocumentUploaded
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly Vehicle $vehicle,
        public readonly VehicleDocument $document,
        public readonly ?string $actor = null,
    ) {}
}
