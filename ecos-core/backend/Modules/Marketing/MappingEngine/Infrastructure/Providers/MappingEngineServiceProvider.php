<?php

declare(strict_types=1);

namespace Modules\Marketing\MappingEngine\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Marketing\MappingEngine\Application\Services\MappingSuggestionService;

final class MappingEngineServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(MappingSuggestionService::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(
            __DIR__.'/../../Database/Migrations',
        );
    }
}
