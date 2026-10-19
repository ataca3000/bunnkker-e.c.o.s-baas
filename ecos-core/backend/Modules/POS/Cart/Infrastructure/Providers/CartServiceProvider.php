<?php

declare(strict_types=1);

namespace Modules\POS\Cart\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\POS\Cart\Domain\Contracts\CartRepositoryInterface;
use Modules\POS\Cart\Infrastructure\Repositories\EloquentCartRepository;

final class CartServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(CartRepositoryInterface::class, EloquentCartRepository::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
