<?php

declare(strict_types=1);

namespace Modules\POS\Shift\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\POS\Shift\Domain\Contracts\ShiftRepositoryInterface;
use Modules\POS\Shift\Infrastructure\Repositories\EloquentShiftRepository;

final class ShiftServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(ShiftRepositoryInterface::class, EloquentShiftRepository::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
