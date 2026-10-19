<?php

declare(strict_types=1);

namespace Modules\Inventory\CountSessions\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;

final class CountSessionsServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
