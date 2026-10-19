<?php

declare(strict_types=1);

namespace Modules\Inventory\ReceiptLayers\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Inventory\ReceiptLayers\Domain\Contracts\InventoryLayerConsumptionRepositoryInterface;
use Modules\Inventory\ReceiptLayers\Infrastructure\Repositories\EloquentInventoryLayerConsumptionRepository;

final class ReceiptLayersServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(
            InventoryLayerConsumptionRepositoryInterface::class,
            EloquentInventoryLayerConsumptionRepository::class,
        );
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
