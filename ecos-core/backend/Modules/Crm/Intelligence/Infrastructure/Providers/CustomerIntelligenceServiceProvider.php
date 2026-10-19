<?php

declare(strict_types=1);

namespace Modules\Crm\Intelligence\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Crm\Intelligence\Domain\Services\ChurnRiskService;
use Modules\Crm\Intelligence\Domain\Services\CustomerAnalyticsService;
use Modules\Crm\Intelligence\Domain\Services\CustomerIntelligenceService;
use Modules\Crm\Intelligence\Domain\Services\CustomerValueService;
use Modules\Crm\Intelligence\Domain\Services\HealthScoreService;
use Modules\Crm\Intelligence\Domain\Services\PurchaseFactService;
use Modules\Crm\Intelligence\Domain\Services\RecommendationEngine;
use Modules\Crm\Intelligence\Domain\Services\RetentionIndicatorService;
use Modules\Crm\Intelligence\Domain\Services\RfmAnalysisService;
use Modules\Crm\Intelligence\Domain\Services\SegmentationService;

/**
 * CRM Customer Intelligence — EPIC C5.
 *
 * ┌─ DETERMINISTIC · EXPLAINABLE · NO GENERATIVE AI ────────────────────────┐
 * │ Health score, RFM, CLV, purchase frequency, churn risk, segmentation and    │
 * │ rule-based recommendations — every result computed from immutable purchase   │
 * │ facts fed by opaque reference. Commerce owns Orders, Finance owns Payments;  │
 * │ the intelligence layer reads neither, only the facts pushed to it.          │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class CustomerIntelligenceServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(PurchaseFactService::class);
        $this->app->singleton(RfmAnalysisService::class);
        $this->app->singleton(CustomerValueService::class);
        $this->app->singleton(ChurnRiskService::class);
        $this->app->singleton(HealthScoreService::class);
        $this->app->singleton(SegmentationService::class);
        $this->app->singleton(RecommendationEngine::class);
        $this->app->singleton(RetentionIndicatorService::class);
        $this->app->singleton(CustomerAnalyticsService::class);
        $this->app->singleton(CustomerIntelligenceService::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
