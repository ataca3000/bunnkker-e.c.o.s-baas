<?php

declare(strict_types=1);

namespace Modules\Marketing\Assets\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Marketing\Assets\Application\Actions\MapAssetAction;
use Modules\Marketing\Assets\Application\Services\AssetHealthService;
use Modules\Marketing\Assets\Application\Services\AssetLifecycleService;

final class MarketingAssetServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(AssetHealthService::class);
        $this->app->singleton(AssetLifecycleService::class);

        $this->app->bind(MapAssetAction::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(
            __DIR__.'/../Database/Migrations',
        );
    }
}
