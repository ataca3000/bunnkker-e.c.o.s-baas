<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseMaterials\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Purchasing\PurchaseMaterials\Domain\Contracts\PurchaseMaterialRepositoryInterface;
use Modules\Purchasing\PurchaseMaterials\Infrastructure\Repositories\EloquentPurchaseMaterialRepository;

final class PurchaseMaterialServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(
            PurchaseMaterialRepositoryInterface::class,
            EloquentPurchaseMaterialRepository::class,
        );
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
