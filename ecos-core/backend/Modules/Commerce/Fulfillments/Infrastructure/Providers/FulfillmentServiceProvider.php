<?php

declare(strict_types=1);

namespace Modules\Commerce\Fulfillments\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Commerce\Fulfillments\Domain\Contracts\FulfillmentRepositoryInterface;
use Modules\Commerce\Fulfillments\Infrastructure\Repositories\EloquentFulfillmentRepository;

final class FulfillmentServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(FulfillmentRepositoryInterface::class, EloquentFulfillmentRepository::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
