<?php

declare(strict_types=1);

namespace Modules\Inventory\StockLedger\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Inventory\StockLedger\Domain\Contracts\StockMovementRepositoryInterface;
use Modules\Inventory\StockLedger\Infrastructure\Repositories\EloquentStockMovementRepository;

final class StockLedgerServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(StockMovementRepositoryInterface::class, EloquentStockMovementRepository::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
