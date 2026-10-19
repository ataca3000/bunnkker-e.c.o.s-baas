<?php

declare(strict_types=1);

namespace Modules\POS\Discount\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\POS\Discount\Domain\Contracts\DiscountRepositoryInterface;
use Modules\POS\Discount\Infrastructure\Repositories\EloquentDiscountRepository;

final class DiscountServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }

    public function register(): void
    {
        $this->app->bind(
            DiscountRepositoryInterface::class,
            EloquentDiscountRepository::class,
        );
    }
}
