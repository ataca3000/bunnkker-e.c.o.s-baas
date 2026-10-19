<?php

declare(strict_types=1);

namespace Modules\Logistics\Intelligence\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Logistics\Intelligence\Domain\Services\ConflictRecommendationEngine;
use Modules\Logistics\Intelligence\Domain\Services\DecisionEngine;
use Modules\Logistics\Intelligence\Domain\Services\DecisionPriorityEngine;
use Modules\Logistics\Intelligence\Domain\Services\EnterpriseDashboardService;
use Modules\Logistics\Intelligence\Domain\Services\ForecastService;
use Modules\Logistics\Intelligence\Domain\Services\InsightService;
use Modules\Logistics\Intelligence\Domain\Services\OptimizationService;
use Modules\Logistics\Intelligence\Domain\Services\RecommendationService;

/**
 * Logistics Intelligence — EPIC-LOG-V2-002.
 *
 * ┌─ A READ-ONLY DECISION-SUPPORT LAYER OVER LOGISTICS V2 ───────────────────┐
 * │ Every service here receives existing Operations and Dispatch services by │
 * │ injection and reads their figures. It creates no table, writes nothing,  │
 * │ owns no state, and re-implements no readiness or capacity calculation.   │
 * │ It registers LAST, because it depends on all the operational modules.     │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class LogisticsIntelligenceServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Decision engine and its collaborators.
        $this->app->singleton(RecommendationService::class);
        $this->app->singleton(ConflictRecommendationEngine::class);
        $this->app->singleton(DecisionPriorityEngine::class);
        $this->app->singleton(DecisionEngine::class);

        // Optimisation, forecasting, and the recommendation (insight) layer.
        $this->app->singleton(OptimizationService::class);
        $this->app->singleton(ForecastService::class);
        $this->app->singleton(InsightService::class);

        // Completion — the aggregated Enterprise Workspace dashboards.
        $this->app->singleton(EnterpriseDashboardService::class);
    }
}
