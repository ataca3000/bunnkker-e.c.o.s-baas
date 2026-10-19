<?php

declare(strict_types=1);

namespace Modules\Commerce\Synchronization\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Commerce\Synchronization\Application\Commands\RegisterWebhooksCommand;
use Modules\Commerce\Synchronization\Application\Observers\CustomerObserver;
use Modules\Commerce\Synchronization\Application\Observers\OrderObserver;
use Modules\Commerce\Synchronization\Application\Observers\ProductObserver;
use Modules\Commerce\Synchronization\Application\Observers\StockMovementObserver;
use Modules\Commerce\Synchronization\Domain\Contracts\SyncLogRepositoryInterface;
use Modules\Commerce\Synchronization\Infrastructure\Repositories\EloquentSyncLogRepository;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Inventory\StockLedger\Domain\Models\StockMovement;
use Modules\Sales\Customers\Domain\Models\Customer;

final class SynchronizationServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(SyncLogRepositoryInterface::class, EloquentSyncLogRepository::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');

        $this->commands([
            RegisterWebhooksCommand::class,
        ]);

        Product::observe(ProductObserver::class);
        StockMovement::observe(StockMovementObserver::class);
        Customer::observe(CustomerObserver::class);
        Order::observe(OrderObserver::class);
    }
}
