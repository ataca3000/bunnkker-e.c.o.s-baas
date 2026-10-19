<?php

declare(strict_types=1);

namespace Modules\Purchasing\SupplierInvoices\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;

final class SupplierInvoiceServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
