<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Domain\Events;

use Modules\Marketing\Campaigns\Domain\Models\CampaignAdSet;

final class AdSetUpdated
{
    public function __construct(
        public readonly CampaignAdSet $adSet,
        public readonly string $previousStatus,
    ) {}
}
