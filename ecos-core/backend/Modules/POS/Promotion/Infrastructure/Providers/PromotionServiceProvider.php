<?php

declare(strict_types=1);

namespace Modules\POS\Promotion\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\POS\Promotion\Domain\Contracts\PromotionRepositoryInterface;
use Modules\POS\Promotion\Infrastructure\Repositories\EloquentPromotionRepository;

final class PromotionServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }

    public function register(): void
    {
        $this->app->bind(
            PromotionRepositoryInterface::class,
            EloquentPromotionRepository::class,
        );
    }
}
