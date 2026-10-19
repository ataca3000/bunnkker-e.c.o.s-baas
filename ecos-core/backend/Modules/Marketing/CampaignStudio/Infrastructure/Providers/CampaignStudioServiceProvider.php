<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Marketing\CampaignStudio\Application\Actions\CreateCampaignDraftAction;
use Modules\Marketing\CampaignStudio\Application\Actions\CreateCampaignFromTemplateAction;
use Modules\Marketing\CampaignStudio\Application\Actions\DuplicateCampaignDraftAction;
use Modules\Marketing\CampaignStudio\Application\Actions\ProcessApprovalDecisionAction;
use Modules\Marketing\CampaignStudio\Application\Actions\PublishCampaignAction;
use Modules\Marketing\CampaignStudio\Application\Actions\SubmitForApprovalAction;
use Modules\Marketing\CampaignStudio\Application\Actions\ValidateCampaignAction;
use Modules\Marketing\CampaignStudio\Application\Services\BulkOperationService;
use Modules\Marketing\CampaignStudio\Application\Services\CampaignApprovalService;
use Modules\Marketing\CampaignStudio\Application\Services\CampaignDraftService;
use Modules\Marketing\CampaignStudio\Application\Services\CampaignSchedulingService;
use Modules\Marketing\CampaignStudio\Application\Services\CampaignTemplateService;
use Modules\Marketing\CampaignStudio\Application\Services\CampaignVersioningService;
use Modules\Marketing\CampaignStudio\Application\Services\CommerceIntegrationService;
use Modules\Marketing\CampaignStudio\Application\Services\GovernancePolicyService;
use Modules\Marketing\CampaignStudio\Application\Services\PublishingEngineService;
use Modules\Marketing\CampaignStudio\Application\Services\ValidationEngineService;

class CampaignStudioServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(CampaignDraftService::class);
        $this->app->singleton(CampaignVersioningService::class);
        $this->app->singleton(CampaignApprovalService::class);
        $this->app->singleton(PublishingEngineService::class);
        $this->app->singleton(ValidationEngineService::class);
        $this->app->singleton(CampaignTemplateService::class);
        $this->app->singleton(GovernancePolicyService::class);
        $this->app->singleton(CommerceIntegrationService::class);
        $this->app->singleton(BulkOperationService::class);
        $this->app->singleton(CampaignSchedulingService::class);

        $this->app->bind(CreateCampaignDraftAction::class);
        $this->app->bind(SubmitForApprovalAction::class);
        $this->app->bind(ProcessApprovalDecisionAction::class);
        $this->app->bind(PublishCampaignAction::class);
        $this->app->bind(ValidateCampaignAction::class);
        $this->app->bind(DuplicateCampaignDraftAction::class);
        $this->app->bind(CreateCampaignFromTemplateAction::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
