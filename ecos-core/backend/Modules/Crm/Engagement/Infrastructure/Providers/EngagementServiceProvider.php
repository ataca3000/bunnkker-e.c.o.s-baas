<?php

declare(strict_types=1);

namespace Modules\Crm\Engagement\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Crm\Engagement\Domain\Services\ActivityService;
use Modules\Crm\Engagement\Domain\Services\CustomerJourneyService;
use Modules\Crm\Engagement\Domain\Services\TaskService;
use Modules\Crm\Engagement\Domain\Services\TimelineService;
use Modules\Crm\Engagement\Infrastructure\Timeline\ConversationTimelineSource;
use Modules\Crm\Engagement\Infrastructure\Timeline\CrmNoteTimelineSource;
use Modules\Crm\Engagement\Infrastructure\Timeline\OrderTimelineSource;

/**
 * CRM Customer Engagement — EPIC C2.
 *
 * ┌─ CRM OWNS ITS ACTIVITIES · READS EVERYTHING ELSE ───────────────────────┐
 * │ Registers the append-only activity/task writers and the timeline read      │
 * │ model. The timeline's sources READ existing systems (conversations, orders,│
 * │ notes) live — the CRM couples to none of their code and copies none of     │
 * │ their data. New sources plug in here without touching the timeline.        │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class EngagementServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(ActivityService::class);
        $this->app->singleton(TaskService::class);

        // The timeline reads from every registered source.
        $this->app->singleton(TimelineService::class, fn ($app) => new TimelineService([
            $app->make(CrmNoteTimelineSource::class),
            $app->make(ConversationTimelineSource::class),
            $app->make(OrderTimelineSource::class),
        ]));

        $this->app->singleton(CustomerJourneyService::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
