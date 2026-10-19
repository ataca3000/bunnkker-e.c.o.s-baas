<?php

declare(strict_types=1);

namespace Modules\Inventory\InventoryItems\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Inventory\InventoryItems\Domain\Contracts\InventoryItemRepositoryInterface;
use Modules\Inventory\InventoryItems\Infrastructure\Repositories\EloquentInventoryItemRepository;

final class InventoryItemServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(InventoryItemRepositoryInterface::class, EloquentInventoryItemRepository::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
