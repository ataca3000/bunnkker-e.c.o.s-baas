<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Application\Actions;

use Modules\Marketing\CampaignStudio\Application\Services\CampaignDraftService;
use Modules\Marketing\CampaignStudio\Application\Services\CampaignVersioningService;
use Modules\Marketing\CampaignStudio\Domain\Enums\VersionChangeType;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignDraft;

class CreateCampaignDraftAction
{
    public function __construct(
        private readonly CampaignDraftService $draftService,
        private readonly CampaignVersioningService $versioningService,
    ) {}

    public function execute(array $data, string $userId): CampaignDraft
    {
        $draft = $this->draftService->create($data, $userId);

        $this->versioningService->snapshot($draft, VersionChangeType::INITIAL, $userId, 'Draft created');

        return $draft->fresh(['audience', 'placement', 'versions']);
    }
}
