<?php

declare(strict_types=1);

namespace Modules\Sales\Customers\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Sales\Customers\Domain\Contracts\CustomerRepositoryInterface;
use Modules\Sales\Customers\Infrastructure\Repositories\EloquentCustomerRepository;

final class CustomerServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(CustomerRepositoryInterface::class, EloquentCustomerRepository::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
