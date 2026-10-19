<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseOrders\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Purchasing\PurchaseOrders\Domain\Contracts\PurchaseOrderRepositoryInterface;
use Modules\Purchasing\PurchaseOrders\Infrastructure\Repositories\EloquentPurchaseOrderRepository;

final class PurchaseOrderServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(PurchaseOrderRepositoryInterface::class, EloquentPurchaseOrderRepository::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
