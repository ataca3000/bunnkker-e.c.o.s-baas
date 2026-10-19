<?php

declare(strict_types=1);

namespace Modules\POS\CashDrawer\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\POS\CashDrawer\Domain\Contracts\CashDrawerRepositoryInterface;
use Modules\POS\CashDrawer\Infrastructure\Repositories\EloquentCashDrawerRepository;

final class CashDrawerServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }

    public function register(): void
    {
        $this->app->bind(
            CashDrawerRepositoryInterface::class,
            EloquentCashDrawerRepository::class,
        );
    }
}
