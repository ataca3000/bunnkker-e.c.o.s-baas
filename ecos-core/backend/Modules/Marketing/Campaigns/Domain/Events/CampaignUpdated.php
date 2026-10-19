<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Domain\Events;

use Modules\Marketing\Campaigns\Domain\Models\Campaign;

final class CampaignUpdated
{
    public function __construct(
        public readonly Campaign $campaign,
        public readonly string $previousStatus,
    ) {}
}
