<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingExecution\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Manufacturing\ManufacturingExecution\Application\Services\ManufacturingExecutor;
use Modules\Manufacturing\ManufacturingExecution\Domain\Contracts\InventoryMutationInterface;
use Modules\Manufacturing\ManufacturingExecution\Domain\Contracts\ManufacturingTransactionRepositoryInterface;
use Modules\Manufacturing\ManufacturingExecution\Domain\Services\ExecutionPipeline;
use Modules\Manufacturing\ManufacturingExecution\Infrastructure\Adapters\InventoryMutationAdapter;
use Modules\Manufacturing\ManufacturingExecution\Infrastructure\Persistence\EloquentManufacturingTransactionRepository;

final class ManufacturingExecutionServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }

    public function register(): void
    {
        $this->app->bind(
            ManufacturingTransactionRepositoryInterface::class,
            EloquentManufacturingTransactionRepository::class,
        );

        // Bind InventoryMutationInterface to the infrastructure adapter.
        // The adapter resolves its own dependencies (InventoryItemRepository,
        // InventoryLayerConsumptionService) from the container.
        $this->app->bind(
            InventoryMutationInterface::class,
            InventoryMutationAdapter::class,
        );

        $this->app->singleton(ExecutionPipeline::class);

        // Executor is a singleton: InventoryMutationInterface + TransactionRepository.
        // No hooks registered by default — inject ManufacturingExecutorHooksInterface
        // binding when the first integration (Cost Engine, Procurement Queue, etc.) is ready.
        $this->app->singleton(ManufacturingExecutor::class, function ($app): ManufacturingExecutor {
            return new ManufacturingExecutor(
                inventory: $app->make(InventoryMutationInterface::class),
                transactions: $app->make(ManufacturingTransactionRepositoryInterface::class),
                hooks: null,
            );
        });
    }
}
