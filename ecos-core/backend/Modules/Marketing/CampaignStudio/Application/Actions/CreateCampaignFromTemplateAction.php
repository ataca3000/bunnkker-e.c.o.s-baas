<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Application\Actions;

use Modules\Marketing\CampaignStudio\Application\Services\CampaignTemplateService;
use Modules\Marketing\CampaignStudio\Application\Services\CampaignVersioningService;
use Modules\Marketing\CampaignStudio\Domain\Enums\VersionChangeType;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignDraft;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignTemplate;

class CreateCampaignFromTemplateAction
{
    public function __construct(
        private readonly CampaignTemplateService $templateService,
        private readonly CampaignVersioningService $versioningService,
    ) {}

    public function execute(CampaignTemplate $template, array $overrides, string $userId): CampaignDraft
    {
        $draft = $this->templateService->createDraftFromTemplate($template, $overrides, $userId);
        $this->versioningService->snapshot($draft, VersionChangeType::INITIAL, $userId, "Created from template: {$template->name}");

        return $draft->fresh(['audience', 'placement']);
    }
}
