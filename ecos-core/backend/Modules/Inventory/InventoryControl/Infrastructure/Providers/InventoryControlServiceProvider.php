<?php

declare(strict_types=1);

namespace Modules\Inventory\InventoryControl\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Inventory\InventoryControl\Application\Commands\CalculateAbcCommand;

final class InventoryControlServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');

        if ($this->app->runningInConsole()) {
            $this->commands([CalculateAbcCommand::class]);
        }
    }
}
