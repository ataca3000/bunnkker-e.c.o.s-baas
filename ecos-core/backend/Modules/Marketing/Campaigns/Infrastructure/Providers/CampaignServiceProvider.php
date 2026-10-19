<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Marketing\Campaigns\Application\Actions\BackfillCampaignInsightsAction;
use Modules\Marketing\Campaigns\Application\Actions\SyncCampaignsAction;
use Modules\Marketing\Campaigns\Application\Actions\UpdateCampaignBusinessContextAction;
use Modules\Marketing\Campaigns\Application\Jobs\InsightsSyncJob;
use Modules\Marketing\Campaigns\Application\Jobs\SyncCampaignsJob;
use Modules\Marketing\Campaigns\Application\Services\CampaignInsightSyncService;
use Modules\Marketing\Campaigns\Application\Services\CampaignRankingService;
use Modules\Marketing\Campaigns\Application\Services\CampaignSyncService;

final class CampaignServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(CampaignSyncService::class);
        $this->app->singleton(CampaignInsightSyncService::class);
        $this->app->singleton(CampaignRankingService::class);

        $this->app->bind(SyncCampaignsAction::class);
        $this->app->bind(BackfillCampaignInsightsAction::class);
        $this->app->bind(UpdateCampaignBusinessContextAction::class);
        $this->app->bind(SyncCampaignsJob::class);
        $this->app->bind(InsightsSyncJob::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(
            __DIR__.'/../Database/Migrations',
        );
    }
}
