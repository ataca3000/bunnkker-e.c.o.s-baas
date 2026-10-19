<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Infrastructure\Providers;

use App\Core\FeatureFlags\FeatureFlagService;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Modules\Operations\Loading\Application\Actions\AllocatePoolToSessionAction;
use Modules\Operations\Loading\Application\Services\AllocationPolicyService;
use Modules\Operations\Loading\Application\Services\AutoAllocationService;
use Modules\Operations\Loading\Domain\Models\AllocationRecord;
use Modules\Operations\Loading\Domain\Models\LoadingSession;
use Modules\Operations\Loading\Domain\Models\VehicleAssignment;
use Modules\Operations\Loading\Domain\Services\AllocationDecisionChainService;
use Modules\Operations\Loading\Domain\Services\LoadingSessionNumberGenerator;
use Modules\Operations\Loading\Domain\Services\RoutePlanNumberGenerator;
use Modules\Operations\Loading\Domain\Services\VehicleAssignmentNumberGenerator;
use Modules\Operations\Loading\Domain\Services\VehicleCapacityValidatorService;
use Modules\Operations\Loading\Domain\Services\VehicleInventoryService;
use Modules\Operations\Loading\Policies\AllocationRecordPolicy;
use Modules\Operations\Loading\Policies\LoadingSessionPolicy;
use Modules\Operations\Loading\Policies\VehicleAssignmentPolicy;

final class LoadingServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(LoadingSessionNumberGenerator::class);
        $this->app->singleton(VehicleAssignmentNumberGenerator::class);
        $this->app->singleton(RoutePlanNumberGenerator::class);
        $this->app->singleton(VehicleInventoryService::class);
        $this->app->singleton(AllocationDecisionChainService::class);
        $this->app->singleton(VehicleCapacityValidatorService::class);

        $this->app->singleton(
            AllocationPolicyService::class,
            fn ($app) => new AllocationPolicyService($app->make(FeatureFlagService::class)),
        );

        $this->app->singleton(AutoAllocationService::class);
        $this->app->singleton(AllocatePoolToSessionAction::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');

        Gate::policy(LoadingSession::class, LoadingSessionPolicy::class);
        Gate::policy(VehicleAssignment::class, VehicleAssignmentPolicy::class);
        Gate::policy(AllocationRecord::class, AllocationRecordPolicy::class);
    }
}
