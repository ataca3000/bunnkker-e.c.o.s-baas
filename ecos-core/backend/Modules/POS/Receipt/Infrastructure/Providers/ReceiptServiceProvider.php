<?php

declare(strict_types=1);

namespace Modules\POS\Receipt\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\POS\Receipt\Domain\Contracts\ReceiptNumberingStrategyInterface;
use Modules\POS\Receipt\Domain\Contracts\ReceiptRepositoryInterface;
use Modules\POS\Receipt\Domain\Policies\ReprintPolicy;
use Modules\POS\Receipt\Domain\Services\ReceiptRenderer;
use Modules\POS\Receipt\Infrastructure\Numbering\SequentialReceiptNumberingStrategy;
use Modules\POS\Receipt\Infrastructure\Repositories\EloquentReceiptRepository;

final class ReceiptServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }

    public function register(): void
    {
        $this->app->bind(
            ReceiptRepositoryInterface::class,
            EloquentReceiptRepository::class,
        );

        $this->app->bind(
            ReceiptNumberingStrategyInterface::class,
            SequentialReceiptNumberingStrategy::class,
        );

        $this->app->singleton(ReprintPolicy::class);
        $this->app->singleton(ReceiptRenderer::class);
    }
}
