<?php

declare(strict_types=1);

namespace Modules\POS\Terminal\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\POS\Terminal\Domain\Contracts\TerminalRepositoryInterface;
use Modules\POS\Terminal\Infrastructure\Repositories\EloquentTerminalRepository;

final class TerminalServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(TerminalRepositoryInterface::class, EloquentTerminalRepository::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
