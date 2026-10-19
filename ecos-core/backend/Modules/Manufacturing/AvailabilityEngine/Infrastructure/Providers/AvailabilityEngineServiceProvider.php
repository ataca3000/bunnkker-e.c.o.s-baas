<?php

declare(strict_types=1);

namespace Modules\Manufacturing\AvailabilityEngine\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Inventory\InventoryItems\Domain\Contracts\InventoryItemRepositoryInterface;
use Modules\Manufacturing\AvailabilityEngine\Domain\Contracts\InventoryReadInterface;
use Modules\Manufacturing\AvailabilityEngine\Domain\Services\InventoryAvailabilityEngine;
use Modules\Manufacturing\AvailabilityEngine\Infrastructure\Readers\EloquentInventoryReader;
use Modules\Manufacturing\BillsOfMaterials\Domain\Contracts\RecipeResolverInterface;

final class AvailabilityEngineServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(
            InventoryReadInterface::class,
            fn ($app) => new EloquentInventoryReader(
                $app->make(InventoryItemRepositoryInterface::class),
            ),
        );

        $this->app->singleton(
            InventoryAvailabilityEngine::class,
            fn ($app) => new InventoryAvailabilityEngine(
                inventory: $app->make(InventoryReadInterface::class),
                resolver: $app->make(RecipeResolverInterface::class),
            ),
        );
    }
}
