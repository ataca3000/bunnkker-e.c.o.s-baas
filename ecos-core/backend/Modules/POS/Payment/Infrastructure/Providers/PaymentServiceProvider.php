<?php

declare(strict_types=1);

namespace Modules\POS\Payment\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\POS\Payment\Domain\Contracts\PaymentRepositoryInterface;
use Modules\POS\Payment\Infrastructure\Repositories\EloquentPaymentRepository;

final class PaymentServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(PaymentRepositoryInterface::class, EloquentPaymentRepository::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
