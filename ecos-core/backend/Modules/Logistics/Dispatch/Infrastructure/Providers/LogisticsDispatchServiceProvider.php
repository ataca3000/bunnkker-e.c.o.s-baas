<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Logistics\Dispatch\Domain\Services\AssignmentScoringService;
use Modules\Logistics\Dispatch\Domain\Services\DispatchProposalService;
use Modules\Logistics\Dispatch\Domain\Services\DispatchReleaseService;
use Modules\Logistics\Dispatch\Domain\Services\ResourcePoolService;

/**
 * Dispatch — which trip gets which resources.
 *
 * ResourcePoolService receives FleetReadinessQueryInterface by injection, which
 * Fleet binds to its own implementation. Dispatch therefore consumes Fleet's
 * PUBLIC contract and never its internals (Directive 5).
 */
final class LogisticsDispatchServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Phase 2 — foundation.
        $this->app->singleton(ResourcePoolService::class);
        $this->app->singleton(AssignmentScoringService::class);
        $this->app->singleton(DispatchProposalService::class);
        $this->app->singleton(DispatchReleaseService::class);

        // Phase 3 — operations. Additive: nothing above changed.
        // ResourceAllocationService is the orchestrator; it receives Fleet's
        // readiness contract and Network's capacity ledger by injection and
        // re-implements neither.
        $this->app->singleton(\Modules\Logistics\Dispatch\Domain\Services\DispatchAuditService::class);
        $this->app->singleton(\Modules\Logistics\Dispatch\Domain\Services\DispatchTimelineService::class);
        $this->app->singleton(\Modules\Logistics\Dispatch\Domain\Services\AssignmentLockService::class);
        $this->app->singleton(\Modules\Logistics\Dispatch\Domain\Services\DispatchSessionService::class);
        $this->app->singleton(\Modules\Logistics\Dispatch\Domain\Services\DispatchQueueService::class);
        $this->app->singleton(\Modules\Logistics\Dispatch\Domain\Services\ConflictDetectionService::class);
        $this->app->singleton(\Modules\Logistics\Dispatch\Domain\Services\ConflictResolutionService::class);
        $this->app->singleton(\Modules\Logistics\Dispatch\Domain\Services\ResourceAllocationService::class);
        $this->app->singleton(\Modules\Logistics\Dispatch\Domain\Services\AssignmentReviewService::class);
        $this->app->singleton(\Modules\Logistics\Dispatch\Domain\Services\DispatchMonitoringService::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
