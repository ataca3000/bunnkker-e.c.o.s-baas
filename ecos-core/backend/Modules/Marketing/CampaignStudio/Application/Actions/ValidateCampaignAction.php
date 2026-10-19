<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Application\Actions;

use Modules\Marketing\CampaignStudio\Application\Services\ValidationEngineService;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignDraft;

class ValidateCampaignAction
{
    public function __construct(private readonly ValidationEngineService $validationEngine) {}

    public function execute(CampaignDraft $draft): array
    {
        return $this->validationEngine->validate($draft);
    }
}
