<?php

declare(strict_types=1);

namespace Modules\Commerce\Channels\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Commerce\Channels\Domain\Contracts\ChannelRepositoryInterface;
use Modules\Commerce\Channels\Domain\Services\SalesChannelCodeGeneratorService;
use Modules\Commerce\Channels\Infrastructure\Repositories\EloquentChannelRepository;

final class ChannelServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(ChannelRepositoryInterface::class, EloquentChannelRepository::class);
        $this->app->singleton(SalesChannelCodeGeneratorService::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
