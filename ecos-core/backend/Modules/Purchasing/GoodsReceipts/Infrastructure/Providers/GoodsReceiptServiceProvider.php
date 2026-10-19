<?php

declare(strict_types=1);

namespace Modules\Purchasing\GoodsReceipts\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Purchasing\GoodsReceipts\Domain\Contracts\GoodsReceiptRepositoryInterface;
use Modules\Purchasing\GoodsReceipts\Infrastructure\Repositories\EloquentGoodsReceiptRepository;

final class GoodsReceiptServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(GoodsReceiptRepositoryInterface::class, EloquentGoodsReceiptRepository::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
