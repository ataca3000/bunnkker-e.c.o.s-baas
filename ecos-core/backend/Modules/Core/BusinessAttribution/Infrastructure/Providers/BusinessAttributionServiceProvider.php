<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Core\BusinessAttribution\Application\Actions\AttachBusinessDnaAction;
use Modules\Core\BusinessAttribution\Application\Actions\CalculateAttributionAction;
use Modules\Core\BusinessAttribution\Application\Actions\PublishBusinessEventAction;
use Modules\Core\BusinessAttribution\Application\Actions\RecordJourneyStepAction;
use Modules\Core\BusinessAttribution\Application\Actions\ReplayEventsAction;
use Modules\Core\BusinessAttribution\Application\Actions\ResolveEntityAtTimeAction;
use Modules\Core\BusinessAttribution\Application\Actions\TraverseCauseEffectAction;
use Modules\Core\BusinessAttribution\Application\Services\AttributionService;
use Modules\Core\BusinessAttribution\Application\Services\BusinessDnaService;
use Modules\Core\BusinessAttribution\Application\Services\BusinessEventBusService;
use Modules\Core\BusinessAttribution\Application\Services\BusinessJourneyService;
use Modules\Core\BusinessAttribution\Application\Services\BusinessMetricsService;
use Modules\Core\BusinessAttribution\Application\Services\EnhancedReplayService;
use Modules\Core\BusinessAttribution\Application\Services\EntityStateResolver;
use Modules\Core\BusinessAttribution\Application\Services\EventReplayService;
use Modules\Core\BusinessAttribution\Application\Services\GraphService;
use Modules\Core\BusinessAttribution\Application\Services\ReplayAuditService;
use Modules\Core\BusinessAttribution\Application\Services\RootCauseTraversalService;
use Modules\Core\BusinessAttribution\Application\Services\TimeMachineService;
use Modules\Core\BusinessAttribution\Application\StateAppliers\CampaignStateApplier;
use Modules\Core\BusinessAttribution\Application\StateAppliers\ConversationStateApplier;
use Modules\Core\BusinessAttribution\Application\StateAppliers\CustomerStateApplier;
use Modules\Core\BusinessAttribution\Application\StateAppliers\LeadStateApplier;
use Modules\Core\BusinessAttribution\Application\StateAppliers\OrderStateApplier;
use Modules\Core\BusinessAttribution\Application\StateAppliers\ShipmentStateApplier;

/**
 * Business Attribution Engine — Core Platform.
 * NEVER depends on Marketing, CRM, Commerce, or any other domain.
 * All other domains depend on BAE.
 */
final class BusinessAttributionServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Singletons — one instance per request lifecycle
        $this->app->singleton(BusinessEventBusService::class);
        $this->app->singleton(BusinessDnaService::class);
        $this->app->singleton(BusinessMetricsService::class);
        $this->app->singleton(AttributionService::class);
        $this->app->singleton(EventReplayService::class);
        $this->app->singleton(GraphService::class);

        // BusinessJourneyService depends on BusinessMetricsService
        $this->app->singleton(BusinessJourneyService::class);

        // ── PATCH-CORE-001: Replay Engine Foundation ──────────────────────────

        // EntityStateResolver: register all built-in state appliers
        $this->app->singleton(EntityStateResolver::class, function (): EntityStateResolver {
            $resolver = new EntityStateResolver;
            $resolver->register(new CustomerStateApplier);
            $resolver->register(new OrderStateApplier);
            $resolver->register(new LeadStateApplier);
            $resolver->register(new ConversationStateApplier);
            $resolver->register(new CampaignStateApplier);
            $resolver->register(new ShipmentStateApplier);

            return $resolver;
        });

        // TimeMachineService depends on EntityStateResolver
        $this->app->singleton(TimeMachineService::class);

        // EnhancedReplayService — hook-aware, typed result
        $this->app->singleton(EnhancedReplayService::class);

        // Root Cause traversal
        $this->app->singleton(RootCauseTraversalService::class);

        // Replay audit log
        $this->app->singleton(ReplayAuditService::class);

        // Actions — lightweight; re-bound per request
        $this->app->bind(PublishBusinessEventAction::class);
        $this->app->bind(AttachBusinessDnaAction::class);
        $this->app->bind(RecordJourneyStepAction::class);
        $this->app->bind(CalculateAttributionAction::class);
        $this->app->bind(ReplayEventsAction::class);
        $this->app->bind(ResolveEntityAtTimeAction::class);
        $this->app->bind(TraverseCauseEffectAction::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
