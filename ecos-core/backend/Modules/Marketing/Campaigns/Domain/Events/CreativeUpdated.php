<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Domain\Events;

use Modules\Marketing\Campaigns\Domain\Models\CampaignCreative;

final class CreativeUpdated
{
    public function __construct(
        public readonly CampaignCreative $creative,
    ) {}
}
