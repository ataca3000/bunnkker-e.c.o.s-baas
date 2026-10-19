<?php

declare(strict_types=1);

namespace Modules\Marketing\Synchronization\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Marketing\Synchronization\Application\Actions\RunSyncAction;

final class SynchronizationServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(RunSyncAction::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(
            __DIR__.'/../../Database/Migrations',
        );
    }
}
