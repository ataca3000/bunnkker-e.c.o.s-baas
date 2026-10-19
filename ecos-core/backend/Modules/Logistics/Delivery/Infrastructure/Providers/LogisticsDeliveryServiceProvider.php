<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Infrastructure\Providers;

use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Modules\Logistics\Delivery\Domain\Contracts\DeliveryRepositoryInterface;
use Modules\Logistics\Delivery\Domain\Models\Delivery;
use Modules\Logistics\Delivery\Domain\Services\CodCompletionService;
use Modules\Logistics\Delivery\Domain\Services\DeliveryExecutionService;
use Modules\Logistics\Delivery\Domain\Services\DeliveryReturnService;
use Modules\Logistics\Delivery\Domain\Services\PodValidationService;
use Modules\Logistics\Delivery\Domain\Services\TrackingProjectionService;
use Modules\Logistics\Delivery\Infrastructure\Repositories\EloquentDeliveryRepository;
use Modules\Logistics\Delivery\Presentation\Policies\DeliveryPolicy;

final class LogisticsDeliveryServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(DeliveryRepositoryInterface::class, EloquentDeliveryRepository::class);
        $this->app->singleton(TrackingProjectionService::class);
        $this->app->singleton(PodValidationService::class);
        $this->app->singleton(DeliveryExecutionService::class);
        $this->app->singleton(DeliveryReturnService::class);
        $this->app->singleton(CodCompletionService::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');

        Gate::policy(Delivery::class, DeliveryPolicy::class);
    }
}
