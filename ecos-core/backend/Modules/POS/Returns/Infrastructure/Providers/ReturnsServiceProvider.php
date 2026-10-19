<?php

declare(strict_types=1);

namespace Modules\POS\Returns\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\POS\Returns\Domain\Contracts\ReturnNumberingStrategyInterface;
use Modules\POS\Returns\Domain\Contracts\SaleReturnRepositoryInterface;
use Modules\POS\Returns\Infrastructure\Numbering\SequentialReturnNumberingStrategy;
use Modules\POS\Returns\Infrastructure\Repositories\EloquentSaleReturnRepository;

final class ReturnsServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(SaleReturnRepositoryInterface::class, EloquentSaleReturnRepository::class);
        $this->app->bind(ReturnNumberingStrategyInterface::class, SequentialReturnNumberingStrategy::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
