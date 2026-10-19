<?php

declare(strict_types=1);

namespace Modules\POS\Pricing\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\POS\Pricing\Domain\Contracts\PricingGatewayInterface;
use Modules\POS\Pricing\Domain\Services\PriceResolutionService;
use Modules\POS\Pricing\Domain\Services\PriceValidator;
use Modules\POS\Pricing\Infrastructure\Gateways\ProductPricingGateway;

final class PricingServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(
            PricingGatewayInterface::class,
            ProductPricingGateway::class,
        );

        $this->app->bind(PriceResolutionService::class, function ($app): PriceResolutionService {
            return new PriceResolutionService(
                $app->make(PricingGatewayInterface::class),
                new PriceValidator,
            );
        });
    }
}
