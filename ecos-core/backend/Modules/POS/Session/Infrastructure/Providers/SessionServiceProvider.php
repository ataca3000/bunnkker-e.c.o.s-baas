<?php

declare(strict_types=1);

namespace Modules\POS\Session\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\POS\Session\Domain\Contracts\SessionRepositoryInterface;
use Modules\POS\Session\Infrastructure\Repositories\EloquentSessionRepository;

final class SessionServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(SessionRepositoryInterface::class, EloquentSessionRepository::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
