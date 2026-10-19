<?php

declare(strict_types=1);

namespace Modules\Inventory\WasteInvestigations\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;

class WasteInvestigationServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
