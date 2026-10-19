<?php

declare(strict_types=1);

namespace Modules\Crm\Executive\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Crm\Executive\Domain\Services\CustomerGrowthService;
use Modules\Crm\Executive\Domain\Services\CustomerKpiService;
use Modules\Crm\Executive\Domain\Services\ExecutiveDashboardService;
use Modules\Crm\Executive\Domain\Services\ExecutiveReportService;
use Modules\Crm\Executive\Domain\Services\LifetimeValueService;
use Modules\Crm\Executive\Domain\Services\LoyaltyPerformanceService;
use Modules\Crm\Executive\Domain\Services\RetentionMetricsService;
use Modules\Crm\Executive\Domain\Services\SalesPerformanceService;
use Modules\Crm\Executive\Domain\Services\SatisfactionService;
use Modules\Crm\Executive\Domain\Services\ServicePerformanceService;

/**
 * CRM Executive Workspace — EPIC C6.
 *
 * ┌─ READ-ONLY · DERIVED ONLY · NO OPERATIONAL WRITES ──────────────────────┐
 * │ The board-level view of the CRM: customer KPIs, growth, retention, churn,   │
 * │ lifetime value, satisfaction and NPS, service SLA, sales and loyalty, plus  │
 * │ monthly/quarterly/annual reports. It owns no tables and writes nothing —    │
 * │ anywhere. Every figure is derived on read from the systems that own it, so  │
 * │ the executive number and the operational number are the same number.        │
 * │ No Finance writes. No Commerce writes. No writes at all.                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class ExecutiveWorkspaceServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(CustomerKpiService::class);
        $this->app->singleton(CustomerGrowthService::class);
        $this->app->singleton(RetentionMetricsService::class);
        $this->app->singleton(LifetimeValueService::class);
        $this->app->singleton(SatisfactionService::class);
        $this->app->singleton(ServicePerformanceService::class);
        $this->app->singleton(SalesPerformanceService::class);
        $this->app->singleton(LoyaltyPerformanceService::class);
        $this->app->singleton(ExecutiveDashboardService::class);
        $this->app->singleton(ExecutiveReportService::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
