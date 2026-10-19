<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Logistics\Operations\Domain\Services\AvailabilityMatrixService;
use Modules\Logistics\Operations\Domain\Services\CapacityMonitoringService;
use Modules\Logistics\Operations\Domain\Services\CapacityRebalancingService;
use Modules\Logistics\Operations\Domain\Services\CapacityReservationService;
use Modules\Logistics\Operations\Domain\Services\ExceptionEscalationService;
use Modules\Logistics\Operations\Domain\Services\ExceptionQueryService;
use Modules\Logistics\Operations\Domain\Services\ExceptionRegistryService;
use Modules\Logistics\Operations\Domain\Services\ExceptionResolutionService;
use Modules\Logistics\Operations\Domain\Services\ActivityTimelineService;
use Modules\Logistics\Operations\Domain\Services\CrossModuleValidationService;
use Modules\Logistics\Operations\Domain\Services\DiagnosticsService;
use Modules\Logistics\Operations\Domain\Services\EnterpriseSummaryService;
use Modules\Logistics\Operations\Domain\Services\OperationalAlertService;
use Modules\Logistics\Operations\Domain\Services\OperationalDashboardService;
use Modules\Logistics\Operations\Domain\Services\OperationalHealthService;
use Modules\Logistics\Operations\Domain\Services\OperationalHistoryService;
use Modules\Logistics\Operations\Domain\Services\PoolHealthService;
use Modules\Logistics\Operations\Domain\Services\ReadinessValidationService;
use Modules\Logistics\Operations\Domain\Services\ReservationAuditService;
use Modules\Logistics\Operations\Domain\Services\ResourcePoolManagementService;
use Modules\Logistics\Operations\Domain\Services\UnifiedResourcePoolService;

/**
 * Logistics Operations — Phase 4.
 *
 * ┌─ THIS CONTEXT OWNS NO BUSINESS STATE IT DID NOT CREATE ─────────────────┐
 * │ Every service here receives another module's authority by injection:     │
 * │   • UnifiedResourcePoolService → Dispatch's ResourcePoolService, which   │
 * │     in turn consumes Fleet's FleetReadinessQueryInterface.               │
 * │   • CapacityReservationService → Network's CapacityLedgerService.        │
 * │   • OperationalHealthService → Phase 3's DispatchMonitoringService.      │
 * │                                                                          │
 * │ Nothing is re-implemented, so no figure on an Operations screen can      │
 * │ disagree with the module that owns it.                                   │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class LogisticsOperationsServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // A — Resource pools.
        $this->app->singleton(ResourcePoolManagementService::class);
        $this->app->singleton(UnifiedResourcePoolService::class);
        $this->app->singleton(PoolHealthService::class);
        $this->app->singleton(AvailabilityMatrixService::class);

        // B — Capacity operations. Every capacity decision stays Network's.
        $this->app->singleton(ReservationAuditService::class);
        $this->app->singleton(CapacityReservationService::class);
        $this->app->singleton(CapacityRebalancingService::class);
        $this->app->singleton(CapacityMonitoringService::class);

        // D — Exceptions. The Phase 3 conflict framework is reused, not replaced.
        $this->app->singleton(ExceptionRegistryService::class);
        $this->app->singleton(ExceptionQueryService::class);
        $this->app->singleton(ExceptionResolutionService::class);
        $this->app->singleton(ExceptionEscalationService::class);
        $this->app->singleton(OperationalAlertService::class);

        // C — Health. Pure roll-up over the four above plus Dispatch.
        $this->app->singleton(OperationalHealthService::class);

        // Phase 5 — read-only surfaces. No new tables, no new writers: every
        // one of these aggregates or unions state the modules above already own.
        $this->app->singleton(OperationalDashboardService::class);
        $this->app->singleton(ActivityTimelineService::class);
        $this->app->singleton(OperationalHistoryService::class);

        // Phase 6 — enterprise readiness, validation, diagnostics and summaries.
        // Pure read-model: each interprets or digests the services above and
        // computes no readiness or capacity of its own.
        $this->app->singleton(CrossModuleValidationService::class);
        $this->app->singleton(ReadinessValidationService::class);
        $this->app->singleton(DiagnosticsService::class);
        $this->app->singleton(EnterpriseSummaryService::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
