<?php

declare(strict_types=1);

namespace Modules\POS\Sale\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\POS\Sale\Domain\Contracts\SaleRepositoryInterface;
use Modules\POS\Sale\Infrastructure\Repositories\EloquentSaleRepository;

final class SaleServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(SaleRepositoryInterface::class, EloquentSaleRepository::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
