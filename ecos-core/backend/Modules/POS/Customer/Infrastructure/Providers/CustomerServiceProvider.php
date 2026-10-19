<?php

declare(strict_types=1);

namespace Modules\POS\Customer\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\POS\Customer\Domain\Contracts\CustomerGatewayInterface;
use Modules\POS\Customer\Domain\Contracts\LoyaltyGatewayInterface;
use Modules\POS\Customer\Domain\Contracts\StoreCreditGatewayInterface;
use Modules\POS\Customer\Domain\Services\CustomerResolutionService;
use Modules\POS\Customer\Domain\Services\CustomerValidator;
use Modules\POS\Customer\Infrastructure\Gateways\NullLoyaltyGateway;
use Modules\POS\Customer\Infrastructure\Gateways\NullStoreCreditGateway;
use Modules\POS\Customer\Infrastructure\Gateways\SalesCustomerGateway;

final class CustomerServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(CustomerGatewayInterface::class, SalesCustomerGateway::class);
        $this->app->bind(LoyaltyGatewayInterface::class, NullLoyaltyGateway::class);
        $this->app->bind(StoreCreditGatewayInterface::class, NullStoreCreditGateway::class);

        $this->app->bind(CustomerResolutionService::class, fn ($app) => new CustomerResolutionService(
            customerGateway: $app->make(CustomerGatewayInterface::class),
            loyaltyGateway: $app->make(LoyaltyGatewayInterface::class),
            storeCreditGateway: $app->make(StoreCreditGatewayInterface::class),
            validator: new CustomerValidator,
        ));
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
