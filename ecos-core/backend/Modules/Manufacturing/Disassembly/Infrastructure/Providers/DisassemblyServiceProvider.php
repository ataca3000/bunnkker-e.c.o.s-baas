<?php

declare(strict_types=1);

namespace Modules\Manufacturing\Disassembly\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Inventory\InventoryItems\Domain\Contracts\InventoryItemRepositoryInterface;
use Modules\Inventory\ReceiptLayers\Application\Services\InventoryLayerConsumptionService;
use Modules\Manufacturing\AvailabilityEngine\Domain\Contracts\InventoryReadInterface;
use Modules\Manufacturing\BillsOfMaterials\Domain\Contracts\RecipeResolverInterface;
use Modules\Manufacturing\Disassembly\Application\Services\DisassemblyExecutor;
use Modules\Manufacturing\Disassembly\Domain\Contracts\DisassemblyTransactionRepositoryInterface;
use Modules\Manufacturing\Disassembly\Domain\Services\DisassemblyPolicy;
use Modules\Manufacturing\Disassembly\Domain\Services\DisassemblyWorkflow;
use Modules\Manufacturing\Disassembly\Infrastructure\Adapters\DisassemblyInventoryAdapter;
use Modules\Manufacturing\Disassembly\Infrastructure\Persistence\EloquentDisassemblyTransactionRepository;

final class DisassemblyServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }

    public function register(): void
    {
        $this->app->bind(
            DisassemblyTransactionRepositoryInterface::class,
            EloquentDisassemblyTransactionRepository::class,
        );

        $this->app->singleton(DisassemblyPolicy::class);

        $this->app->singleton(
            DisassemblyWorkflow::class,
            fn ($app): DisassemblyWorkflow => new DisassemblyWorkflow(
                resolver: $app->make(RecipeResolverInterface::class),
                inventoryReader: $app->make(InventoryReadInterface::class),
            ),
        );

        $this->app->singleton(
            DisassemblyInventoryAdapter::class,
            fn ($app): DisassemblyInventoryAdapter => new DisassemblyInventoryAdapter(
                inventoryItems: $app->make(InventoryItemRepositoryInterface::class),
                layerService: $app->make(InventoryLayerConsumptionService::class),
            ),
        );

        $this->app->singleton(
            DisassemblyExecutor::class,
            fn ($app): DisassemblyExecutor => new DisassemblyExecutor(
                inventory: $app->make(DisassemblyInventoryAdapter::class),
                transactions: $app->make(DisassemblyTransactionRepositoryInterface::class),
            ),
        );
    }
}
