<?php

declare(strict_types=1);

namespace Modules\Logistics\Automation\Infrastructure\Providers;

use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;
use Modules\Logistics\Automation\Application\Listeners\DiagnosticsGeneratedListener;
use Modules\Logistics\Automation\Application\Listeners\DispatchConflictDetectedListener;
use Modules\Logistics\Automation\Application\Listeners\DispatchConflictResolvedListener;
use Modules\Logistics\Automation\Application\Listeners\ExecutiveSummaryGeneratedListener;
use Modules\Logistics\Automation\Application\Listeners\LogisticsHealthCalculatedListener;
use Modules\Logistics\Automation\Application\Listeners\OperationalExceptionRaisedListener;
use Modules\Logistics\Automation\Application\Listeners\OperationalExceptionResolvedListener;
use Modules\Logistics\Automation\Application\Listeners\ReadinessValidatedListener;
use Modules\Logistics\Automation\Domain\Services\AutomationEngine;
use Modules\Logistics\Automation\Domain\Services\RuleEngine;
use Modules\Logistics\Dispatch\Domain\Events\DispatchConflictDetected;
use Modules\Logistics\Dispatch\Domain\Events\DispatchConflictResolved;
use Modules\Logistics\Operations\Domain\Events\DiagnosticsGenerated;
use Modules\Logistics\Operations\Domain\Events\ExecutiveSummaryGenerated;
use Modules\Logistics\Operations\Domain\Events\LogisticsHealthCalculated;
use Modules\Logistics\Operations\Domain\Events\OperationalExceptionRaised;
use Modules\Logistics\Operations\Domain\Events\OperationalExceptionResolved;
use Modules\Logistics\Operations\Domain\Events\ReadinessValidated;

/**
 * Logistics Automation — EPIC-LOG-V2-002 / TASK-LOG-V2-002-002.
 *
 * ┌─ A NOTIFICATION & OBSERVABILITY LAYER OVER THE DOMAIN EVENTS ────────────┐
 * │ It CONSUMES the eight operational events and turns them into logs and    │
 * │ notifications. It creates no table, writes no operational state, and     │
 * │ calls no operational service — every consumer runs through the           │
 * │ exception-safe AutomationEngine. Registers last, after every module      │
 * │ whose events it consumes.                                                │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class LogisticsAutomationServiceProvider extends ServiceProvider
{
    /**
     * The canonical event → consumer map. The single source of truth for both
     * registration (below) and the monitoring surface.
     *
     * @var array<class-string, class-string>
     */
    public const LISTENERS = [
        ReadinessValidated::class => ReadinessValidatedListener::class,
        LogisticsHealthCalculated::class => LogisticsHealthCalculatedListener::class,
        DiagnosticsGenerated::class => DiagnosticsGeneratedListener::class,
        ExecutiveSummaryGenerated::class => ExecutiveSummaryGeneratedListener::class,
        OperationalExceptionRaised::class => OperationalExceptionRaisedListener::class,
        OperationalExceptionResolved::class => OperationalExceptionResolvedListener::class,
        DispatchConflictDetected::class => DispatchConflictDetectedListener::class,
        DispatchConflictResolved::class => DispatchConflictResolvedListener::class,
    ];

    public function register(): void
    {
        $this->app->singleton(RuleEngine::class);
        $this->app->singleton(AutomationEngine::class);
    }

    public function boot(): void
    {
        // Consume every domain event. Listeners are queued (ShouldQueue), so in
        // production they run on workers off the operational path.
        foreach (self::LISTENERS as $event => $listener) {
            Event::listen($event, $listener);
        }
    }
}
