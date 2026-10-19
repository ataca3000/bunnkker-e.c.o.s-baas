<?php

declare(strict_types=1);

namespace Modules\Inventory\Transfer\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;

final class TransferServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
