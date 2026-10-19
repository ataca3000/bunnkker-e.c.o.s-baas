<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Infrastructure\Providers;

use App\Core\Audit\AuditService;
use App\Core\Documents\DocumentService;
use App\Core\FeatureFlags\FeatureFlagService;
use App\Core\Timeline\TimelineService;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Inventory\DomainEvents\Events\InventoryStockReceived;
use Modules\Operations\Preparation\Application\Events\Inbound\LoadingPoolReservationReleasedEvent;
use Modules\Operations\Preparation\Application\Events\Inbound\LoadingPoolReservedEvent;
use Modules\Operations\Preparation\Application\Events\Inbound\LoadingProductLoadedEvent;
use Modules\Operations\Preparation\Application\Events\Inbound\ManufacturingJobCompletedEvent;
use Modules\Operations\Preparation\Application\Events\Inbound\ManufacturingJobCreatedEvent;
use Modules\Operations\Preparation\Application\Listeners\LoadingPoolReservationReleasedListener;
use Modules\Operations\Preparation\Application\Listeners\LoadingPoolReservedListener;
use Modules\Operations\Preparation\Application\Listeners\LoadingProductLoadedListener;
use Modules\Operations\Preparation\Application\Listeners\ManufacturingJobCompletedListener;
use Modules\Operations\Preparation\Application\Listeners\ManufacturingJobCreatedListener;
use Modules\Operations\Preparation\Application\Listeners\StockAddedListener;
use Modules\Operations\Preparation\Application\Listeners\WarehouseAssignedListener;
use Modules\Operations\Preparation\Application\Observers\OrderPreparationObserver;
use Modules\Operations\Preparation\Application\Services\DailyPreparationSessionManager;
use Modules\Operations\Preparation\Application\Services\PreparationReleaseEngine;
use Modules\Operations\Preparation\Application\Services\SoftReservationService;
use Modules\Operations\Preparation\Application\Services\WarehouseAssignmentEngine;
use Modules\Operations\Preparation\Application\Services\WaveEngine\DemandRefreshDispatcher;
use Modules\Operations\Preparation\Application\Services\WaveEngine\WaveLifecycleService;
use Modules\Operations\Preparation\Application\Services\WaveEngine\WaveManager;
use Modules\Operations\Preparation\Application\Services\WaveEngine\WaveMembershipService;
use Modules\Operations\Preparation\Application\Services\WaveEngine\WavePreparationService;
use Modules\Operations\Preparation\Domain\Events\WarehouseAssigned;
use Modules\Operations\Preparation\Domain\Models\PreparationSession;
use Modules\Operations\Preparation\Domain\Models\PreparationStation;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;
use Modules\Operations\Preparation\Domain\Models\PreparedProductsPool;
use Modules\Operations\Preparation\Domain\Services\BrandConfigurationResolverService;
use Modules\Operations\Preparation\Domain\Services\EnterpriseQueueSorterService;
use Modules\Operations\Preparation\Domain\Services\FulfillmentPolicyService;
use Modules\Operations\Preparation\Domain\Services\PreparationPolicyService;
use Modules\Operations\Preparation\Infrastructure\Console\Commands\CreateDailyPreparationSessionsCommand;
use Modules\Operations\Preparation\Infrastructure\Console\Commands\FreezePreparationSessionsCommand;
use Modules\Operations\Preparation\Infrastructure\Console\Commands\RunWaveSchedulerCommand;
use Modules\Operations\Preparation\Policies\PreparationSessionPolicy;
use Modules\Operations\Preparation\Policies\PreparationStationPolicy;
use Modules\Operations\Preparation\Policies\PreparationWavePolicy;
use Modules\Operations\Preparation\Policies\PreparedPoolPolicy;

final class PreparationServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(AuditService::class);
        $this->app->singleton(FeatureFlagService::class);
        $this->app->singleton(TimelineService::class);
        $this->app->singleton(DocumentService::class);

        $this->app->singleton(
            FulfillmentPolicyService::class,
            fn ($app) => new FulfillmentPolicyService($app->make(FeatureFlagService::class)),
        );

        $this->app->singleton(
            PreparationPolicyService::class,
            fn ($app) => new PreparationPolicyService($app->make(FeatureFlagService::class)),
        );

        $this->app->singleton(SoftReservationService::class);
        $this->app->singleton(BrandConfigurationResolverService::class);
        $this->app->singleton(EnterpriseQueueSorterService::class);

        // CR-PREP-001 — Warehouse Assignment & Daily Sessions
        $this->app->singleton(WarehouseAssignmentEngine::class);
        $this->app->singleton(PreparationReleaseEngine::class);
        $this->app->singleton(DailyPreparationSessionManager::class);

        // TASK-WAVE-ENGINE-001 — Wave Engine services
        $this->app->singleton(DemandRefreshDispatcher::class);
        $this->app->singleton(WaveManager::class);
        $this->app->singleton(WaveLifecycleService::class);
        $this->app->singleton(WaveMembershipService::class);
        $this->app->singleton(WavePreparationService::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');

        $this->commands([
            CreateDailyPreparationSessionsCommand::class,
            FreezePreparationSessionsCommand::class,
            RunWaveSchedulerCommand::class,
        ]);

        Gate::policy(PreparationWave::class, PreparationWavePolicy::class);
        Gate::policy(PreparationSession::class, PreparationSessionPolicy::class);
        Gate::policy(PreparedProductsPool::class, PreparedPoolPolicy::class);
        Gate::policy(PreparationStation::class, PreparationStationPolicy::class);

        $events = $this->app->make('events');

        // Inbound listeners (other modules → Preparation)
        $events->listen(InventoryStockReceived::class, StockAddedListener::class);
        $events->listen(ManufacturingJobCreatedEvent::class, ManufacturingJobCreatedListener::class);
        $events->listen(ManufacturingJobCompletedEvent::class, ManufacturingJobCompletedListener::class);
        $events->listen(LoadingPoolReservedEvent::class, LoadingPoolReservedListener::class);
        $events->listen(LoadingPoolReservationReleasedEvent::class, LoadingPoolReservationReleasedListener::class);
        $events->listen(LoadingProductLoadedEvent::class, LoadingProductLoadedListener::class);

        // CR-PREP-001 — auto-attach orders to today's preparation session
        $events->listen(WarehouseAssigned::class, WarehouseAssignedListener::class);

        // CR-PREP-001HF — auto-detach orders that become ineligible
        Order::observe(OrderPreparationObserver::class);
    }
}
