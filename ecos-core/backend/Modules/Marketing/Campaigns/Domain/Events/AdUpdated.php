<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Domain\Events;

use Modules\Marketing\Campaigns\Domain\Models\CampaignAd;

final class AdUpdated
{
    public function __construct(
        public readonly CampaignAd $ad,
        public readonly string $previousStatus,
    ) {}
}
