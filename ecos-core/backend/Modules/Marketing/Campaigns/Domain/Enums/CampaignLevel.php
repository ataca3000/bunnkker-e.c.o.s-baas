<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Domain\Enums;

enum CampaignLevel: string
{
    case Campaign = 'campaign';
    case AdSet = 'adset';
    case Ad = 'ad';
}
