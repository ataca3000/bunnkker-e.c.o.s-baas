<?php

declare(strict_types=1);

namespace Modules\Marketing\Initiatives\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Marketing\Initiatives\Application\Actions\AssignCampaignsToInitiativeAction;
use Modules\Marketing\Initiatives\Application\Actions\CreateInitiativeFromTemplateAction;
use Modules\Marketing\Initiatives\Application\Actions\RemoveCampaignFromInitiativeAction;
use Modules\Marketing\Initiatives\Application\Services\InitiativeKpiService;

final class InitiativeServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(InitiativeKpiService::class);

        $this->app->bind(AssignCampaignsToInitiativeAction::class);
        $this->app->bind(RemoveCampaignFromInitiativeAction::class);
        $this->app->bind(CreateInitiativeFromTemplateAction::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(
            __DIR__.'/../Database/Migrations',
        );
    }
}
