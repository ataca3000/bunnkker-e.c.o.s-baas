<?php

declare(strict_types=1);

namespace Modules\Marketing\Intelligence\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Marketing\Intelligence\Application\Actions\GenerateReportAction;
use Modules\Marketing\Intelligence\Application\Services\MarketingHealthScoreService;
use Modules\Marketing\Intelligence\Application\Services\MarketingKpiEngine;

final class MarketingIntelligenceServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // KpiEngine is a singleton — it maintains an in-process request cache
        // in addition to the external Laravel cache, avoiding repeated DB round-trips
        // within the same HTTP request when the dashboard calls kpis() + growth() + top().
        $this->app->singleton(MarketingKpiEngine::class);
        $this->app->singleton(MarketingHealthScoreService::class);

        $this->app->bind(GenerateReportAction::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(
            __DIR__.'/../Database/Migrations',
        );
    }
}
