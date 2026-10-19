<?php

declare(strict_types=1);

namespace Modules\Logistics\Automation\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Logistics\Automation\Domain\Policies\AutomationPolicy;
use Modules\Logistics\Automation\Domain\Policies\AutomationPolicyRegistry;
use Modules\Logistics\Automation\Infrastructure\Providers\LogisticsAutomationServiceProvider;
use Modules\Logistics\Dispatch\Domain\Services\DispatchMonitoringService;
use Modules\Logistics\Operations\Domain\Services\ExceptionQueryService;
use Modules\Logistics\Operations\Domain\Services\OperationalAlertService;

/**
 * The automation platform's observability surface — read-only.
 *
 * Reports the platform's configuration (consumers, policies, queue/retry) and
 * scrapes the current operational metrics from the existing monitoring services.
 * It computes nothing of its own and writes nothing.
 */
class AutomationMonitoringService
{
    /** The retry policy declared on every consumer. */
    private const RETRY = ['tries' => 3, 'backoff' => [10, 30, 60], 'max_exceptions' => 3];

    public function __construct(
        private readonly AutomationPolicyRegistry $policies,
        private readonly ExceptionQueryService $exceptions,
        private readonly DispatchMonitoringService $dispatch,
        private readonly OperationalAlertService $alerts,
    ) {}

    /**
     * The declared automation policies.
     *
     * @return list<array<string, mixed>>
     */
    public function policies(): array
    {
        return array_map(static fn (AutomationPolicy $p) => $p->toArray(), $this->policies->all());
    }

    /**
     * Automation health — what is wired up and how it will behave.
     *
     * @return array<string, mixed>
     */
    public function monitoring(): array
    {
        $consumers = [];
        foreach (LogisticsAutomationServiceProvider::LISTENERS as $event => $listener) {
            $consumers[] = ['event' => class_basename($event), 'consumer' => class_basename($listener)];
        }

        $policies = $this->policies->all();

        return [
            'generated_at' => Carbon::now()->toIso8601String(),
            'consumers' => $consumers,
            'consumer_count' => count($consumers),
            'events_consumed' => count($consumers),
            'policy_count' => count($policies),
            'active_policy_count' => count(array_filter($policies, static fn (AutomationPolicy $p) => $p->active)),
            'event_logging' => 'structured_log',
            'queue' => [
                'connection' => (string) config('queue.default'),
                'retry' => self::RETRY,
            ],
        ];
    }

    /**
     * Operational metrics for a monitoring scrape — read from the existing
     * services, never recomputed.
     *
     * @return array<string, mixed>
     */
    public function metrics(?string $companyId = null): array
    {
        $exceptions = $this->exceptions->summary($companyId);
        $health = $this->dispatch->assignmentHealth($companyId);
        $alerts = $this->alerts->summary($companyId);

        return [
            'generated_at' => Carbon::now()->toIso8601String(),
            'exceptions' => [
                'outstanding' => $exceptions['outstanding'],
                'critical' => $exceptions['critical'],
                'needs_attention' => $exceptions['needs_attention'],
                'overdue_for_escalation' => $exceptions['overdue_for_escalation'],
            ],
            'conflicts' => [
                'open' => $health['open_conflicts'],
                'blocking' => $health['blocking_conflicts'],
            ],
            'alerts' => [
                'total' => $alerts['total'],
                'critical' => $alerts['critical'],
                'unacknowledged' => $alerts['unacknowledged'],
            ],
        ];
    }
}
