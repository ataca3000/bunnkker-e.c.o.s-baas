<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Infrastructure\Providers;

use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;
use Modules\Operations\Fulfillment\Application\FulfillmentEngine;
use Modules\Operations\Fulfillment\Application\Listeners\HandleOrderConfirmed;
use Modules\Operations\Fulfillment\Application\Listeners\HandleOrderDelivered;
use Modules\Operations\Fulfillment\Application\Listeners\HandleOrderDispatched;
use Modules\Operations\Fulfillment\Application\Services\BulkWorkflowEngine;
use Modules\Operations\Fulfillment\Application\Workflows\ApprovePartialReservationWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\CancelOrderWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\CompleteDeliveryWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\CompleteOrderWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\ConfirmOrderWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\DispatchOrderWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\LoadVehicleWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\MarkAwaitingStockWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\MoveToPreparationWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\MoveToReviewWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\ReceiveReturnWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\RescheduleOrderWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\ResumeOrderWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\ResumeToConfirmedWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\ReturnOrderWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\ReturnToConfirmedWorkflow;
use Modules\Operations\Fulfillment\Domain\Events\OrderConfirmedEvent;
use Modules\Operations\Fulfillment\Domain\Events\OrderDeliveredEvent;
use Modules\Operations\Fulfillment\Domain\Events\OrderDispatchedEvent;

final class FulfillmentServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(FulfillmentEngine::class);
        $this->app->singleton(BulkWorkflowEngine::class);

        // Workflows — transient: each request gets a fresh instance
        $this->app->bind(ConfirmOrderWorkflow::class);
        $this->app->bind(CancelOrderWorkflow::class);
        $this->app->bind(MoveToPreparationWorkflow::class);
        $this->app->bind(CompleteDeliveryWorkflow::class);
        $this->app->bind(CompleteOrderWorkflow::class);
        $this->app->bind(MarkAwaitingStockWorkflow::class);
        $this->app->bind(ReturnOrderWorkflow::class);
        $this->app->bind(DispatchOrderWorkflow::class);
        $this->app->bind(LoadVehicleWorkflow::class);
        $this->app->bind(ReceiveReturnWorkflow::class);
        $this->app->bind(RescheduleOrderWorkflow::class);
        $this->app->bind(ResumeOrderWorkflow::class);
        $this->app->bind(ResumeToConfirmedWorkflow::class);
        $this->app->bind(ReturnToConfirmedWorkflow::class);
        $this->app->bind(MoveToReviewWorkflow::class);
        $this->app->bind(ApprovePartialReservationWorkflow::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(
            __DIR__.'/../Database/Migrations',
        );

        Event::listen(OrderConfirmedEvent::class, HandleOrderConfirmed::class);
        Event::listen(OrderDispatchedEvent::class, HandleOrderDispatched::class);
        Event::listen(OrderDeliveredEvent::class, HandleOrderDelivered::class);
    }
}
