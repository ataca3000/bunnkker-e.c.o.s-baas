<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Domain\Events;

use Modules\Marketing\Campaigns\Domain\Models\Campaign;

final class CampaignDiscovered
{
    public function __construct(
        public readonly Campaign $campaign,
        public readonly bool $isNew,
    ) {}
}
