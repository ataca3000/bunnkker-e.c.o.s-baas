<?php

declare(strict_types=1);

namespace Modules\POS\Application\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\POS\Application\Contracts\DomainEventPublisherInterface;
use Modules\POS\Application\Infrastructure\EventPublishing\LaravelDomainEventPublisher;
use Modules\POS\Application\Services\AddCartLineService;
use Modules\POS\Application\Services\ApproveShiftService;
use Modules\POS\Application\Services\CancelCartService;
use Modules\POS\Application\Services\CloseSessionService;
use Modules\POS\Application\Services\CloseShiftService;
use Modules\POS\Application\Services\FindCartService;
use Modules\POS\Application\Services\FindReceiptService;
use Modules\POS\Application\Services\FindSaleService;
use Modules\POS\Application\Services\FindSessionService;
use Modules\POS\Application\Services\FindShiftService;
use Modules\POS\Application\Services\HoldCartService;
use Modules\POS\Application\Services\OpenCartService;
use Modules\POS\Application\Services\OpenSessionService;
use Modules\POS\Application\Services\OpenShiftService;
use Modules\POS\Application\Services\ProcessExchangeService;
use Modules\POS\Application\Services\ProcessReturnService;
use Modules\POS\Application\Services\ProcessSaleService;
use Modules\POS\Application\Services\RejectShiftService;
use Modules\POS\Application\Services\RemoveCartLineService;
use Modules\POS\Application\Services\ReprintReceiptService;
use Modules\POS\Application\Services\ResumeCartService;
use Modules\POS\Application\Services\SetCartCustomerService;
use Modules\POS\Application\Services\VoidReceiptService;

final class ApplicationServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }

    public function register(): void
    {
        $this->app->bind(DomainEventPublisherInterface::class, LaravelDomainEventPublisher::class);

        $this->app->singleton(OpenSessionService::class);
        $this->app->singleton(CloseSessionService::class);
        $this->app->singleton(FindSessionService::class);
        $this->app->singleton(OpenShiftService::class);
        $this->app->singleton(CloseShiftService::class);
        $this->app->singleton(FindShiftService::class);
        $this->app->singleton(ApproveShiftService::class);
        $this->app->singleton(RejectShiftService::class);
        $this->app->singleton(OpenCartService::class);
        $this->app->singleton(AddCartLineService::class);
        $this->app->singleton(RemoveCartLineService::class);
        $this->app->singleton(HoldCartService::class);
        $this->app->singleton(ResumeCartService::class);
        $this->app->singleton(CancelCartService::class);
        $this->app->singleton(FindCartService::class);
        $this->app->singleton(ProcessSaleService::class);
        $this->app->singleton(FindSaleService::class);
        $this->app->singleton(ProcessReturnService::class);
        $this->app->singleton(ProcessExchangeService::class);
        $this->app->singleton(ReprintReceiptService::class);
        $this->app->singleton(VoidReceiptService::class);
        $this->app->singleton(FindReceiptService::class);
        $this->app->singleton(SetCartCustomerService::class);
    }
}
