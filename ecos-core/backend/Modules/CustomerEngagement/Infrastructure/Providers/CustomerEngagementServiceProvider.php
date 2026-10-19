<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\CustomerEngagement\Application\Actions\ApplyMacroAction;
use Modules\CustomerEngagement\Application\Actions\AssignConversationAction;
use Modules\CustomerEngagement\Application\Actions\AutoRouteConversationAction;
use Modules\CustomerEngagement\Application\Actions\CaptureAttributionAction;
use Modules\CustomerEngagement\Application\Actions\CloseConversationAction;
use Modules\CustomerEngagement\Application\Actions\CreateConversationAction;
use Modules\CustomerEngagement\Application\Actions\CreateLeadFromConversationAction;
use Modules\CustomerEngagement\Application\Actions\CreateOrderFromConversationAction;
use Modules\CustomerEngagement\Application\Actions\IngestInboundMessageAction;
use Modules\CustomerEngagement\Application\Actions\IngestMessageAction;
use Modules\CustomerEngagement\Application\Actions\SendOutboundMessageAction;
use Modules\CustomerEngagement\Application\Services\AssignmentService;
use Modules\CustomerEngagement\Application\Services\AttributionCaptureService;
use Modules\CustomerEngagement\Application\Services\ChannelProviderService;
use Modules\CustomerEngagement\Application\Services\ConversationCommerceService;
use Modules\CustomerEngagement\Application\Services\ConversationService;
use Modules\CustomerEngagement\Application\Services\DashboardService;
use Modules\CustomerEngagement\Application\Services\LeadService;
use Modules\CustomerEngagement\Application\Services\MacroService;
use Modules\CustomerEngagement\Application\Services\MessageService;
use Modules\CustomerEngagement\Application\Services\OutboundMessageService;
use Modules\CustomerEngagement\Application\Services\ProductSelectorService;
use Modules\CustomerEngagement\Application\Services\RoutingService;
use Modules\CustomerEngagement\Application\Services\SlaService;
use Modules\CustomerEngagement\Application\Services\UnifiedInboxService;
use Modules\CustomerEngagement\Application\Services\WebhookIngestService;

class CustomerEngagementServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // ── Core CEP services ─────────────────────────────────────────────────────
        $this->app->singleton(ConversationService::class);
        $this->app->singleton(SlaService::class);
        $this->app->singleton(LeadService::class);
        $this->app->singleton(AssignmentService::class);

        $this->app->singleton(MessageService::class, function ($app) {
            return new MessageService($app->make(ConversationService::class));
        });

        $this->app->singleton(UnifiedInboxService::class, function ($app) {
            return new UnifiedInboxService($app->make(ConversationService::class));
        });

        $this->app->singleton(DashboardService::class, function ($app) {
            return new DashboardService(
                $app->make(UnifiedInboxService::class),
                $app->make(SlaService::class),
            );
        });

        // ── MKT-007: Omnichannel Commerce services ────────────────────────────────
        $this->app->singleton(ChannelProviderService::class);
        $this->app->singleton(MacroService::class);
        $this->app->singleton(RoutingService::class);
        $this->app->singleton(AttributionCaptureService::class);
        $this->app->singleton(ProductSelectorService::class);

        $this->app->singleton(OutboundMessageService::class, function ($app) {
            return new OutboundMessageService(
                $app->make(ChannelProviderService::class),
                $app->make(ConversationService::class),
            );
        });

        $this->app->singleton(WebhookIngestService::class, function ($app) {
            return new WebhookIngestService(
                $app->make(ConversationService::class),
                $app->make(AttributionCaptureService::class),
                $app->make(RoutingService::class),
            );
        });

        $this->app->singleton(ConversationCommerceService::class);

        // ── Core CEP actions ──────────────────────────────────────────────────────
        $this->app->bind(CreateConversationAction::class, function ($app) {
            return new CreateConversationAction(
                $app->make(ConversationService::class),
                $app->make(SlaService::class),
            );
        });

        $this->app->bind(IngestMessageAction::class, function ($app) {
            return new IngestMessageAction(
                $app->make(ConversationService::class),
                $app->make(MessageService::class),
            );
        });

        $this->app->bind(CreateLeadFromConversationAction::class, function ($app) {
            return new CreateLeadFromConversationAction($app->make(LeadService::class));
        });

        $this->app->bind(CloseConversationAction::class, function ($app) {
            return new CloseConversationAction(
                $app->make(ConversationService::class),
                $app->make(SlaService::class),
            );
        });

        $this->app->bind(AssignConversationAction::class, function ($app) {
            return new AssignConversationAction($app->make(AssignmentService::class));
        });

        // ── MKT-007 actions ───────────────────────────────────────────────────────
        $this->app->bind(IngestInboundMessageAction::class, function ($app) {
            return new IngestInboundMessageAction(
                $app->make(ChannelProviderService::class),
                $app->make(WebhookIngestService::class),
            );
        });

        $this->app->bind(SendOutboundMessageAction::class, function ($app) {
            return new SendOutboundMessageAction($app->make(OutboundMessageService::class));
        });

        $this->app->bind(ApplyMacroAction::class, function ($app) {
            return new ApplyMacroAction(
                $app->make(MacroService::class),
                $app->make(OutboundMessageService::class),
            );
        });

        $this->app->bind(AutoRouteConversationAction::class, function ($app) {
            return new AutoRouteConversationAction($app->make(RoutingService::class));
        });

        $this->app->bind(CreateOrderFromConversationAction::class, function ($app) {
            return new CreateOrderFromConversationAction($app->make(ConversationCommerceService::class));
        });

        $this->app->bind(CaptureAttributionAction::class, function ($app) {
            return new CaptureAttributionAction($app->make(AttributionCaptureService::class));
        });
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
