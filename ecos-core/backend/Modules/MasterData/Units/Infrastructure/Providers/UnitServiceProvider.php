<?php

declare(strict_types=1);

namespace Modules\MasterData\Units\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\MasterData\Units\Domain\Contracts\UnitRepositoryInterface;
use Modules\MasterData\Units\Infrastructure\Repositories\EloquentUnitRepository;

/**
 * Service provider for the Master Data / Units module.
 */
final class UnitServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(UnitRepositoryInterface::class, EloquentUnitRepository::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
