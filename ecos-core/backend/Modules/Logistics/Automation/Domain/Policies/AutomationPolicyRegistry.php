<?php

declare(strict_types=1);

namespace Modules\Logistics\Automation\Domain\Policies;

use Modules\Logistics\Automation\Domain\Enums\AutomationActionType;

/**
 * The declared automation policies.
 *
 * ┌─ DECLARED IN CODE, READ-ONLY, NO SCHEMA ────────────────────────────────┐
 * │ The policy set is a static, immutable declaration — no table, no cache.  │
 * │ It states, per event, when a notification should be raised and to whom.  │
 * │ Every action is a notification (log / notify / alert / escalation        │
 * │ notice); none touches the operation.                                     │
 * │                                                                          │
 * │ Exception ALERT rules already live in Operations (ops_alert_rules) and   │
 * │ are not duplicated here — these policies route the DOMAIN EVENTS into    │
 * │ notification and observability, which is what was missing.               │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class AutomationPolicyRegistry
{
    /** Event class names consumed, kept as constants to avoid hard imports. */
    private const E_READINESS = 'Modules\\Logistics\\Operations\\Domain\\Events\\ReadinessValidated';

    private const E_HEALTH = 'Modules\\Logistics\\Operations\\Domain\\Events\\LogisticsHealthCalculated';

    private const E_DIAGNOSTICS = 'Modules\\Logistics\\Operations\\Domain\\Events\\DiagnosticsGenerated';

    private const E_EXEC_SUMMARY = 'Modules\\Logistics\\Operations\\Domain\\Events\\ExecutiveSummaryGenerated';

    private const E_EXCEPTION_RAISED = 'Modules\\Logistics\\Operations\\Domain\\Events\\OperationalExceptionRaised';

    private const E_EXCEPTION_RESOLVED = 'Modules\\Logistics\\Operations\\Domain\\Events\\OperationalExceptionResolved';

    private const E_CONFLICT_DETECTED = 'Modules\\Logistics\\Dispatch\\Domain\\Events\\DispatchConflictDetected';

    private const E_CONFLICT_RESOLVED = 'Modules\\Logistics\\Dispatch\\Domain\\Events\\DispatchConflictResolved';

    /** @var list<AutomationPolicy>|null */
    private ?array $policies = null;

    /** @return list<AutomationPolicy> */
    public function all(): array
    {
        return $this->policies ??= [
            // Readiness: a not-ready operation is a critical alert; otherwise logged.
            new AutomationPolicy('readiness.not_ready', self::E_READINESS, AutomationActionType::Alert, 'internal', 'operations_manager', minSeverity: 'critical'),
            new AutomationPolicy('readiness.logged', self::E_READINESS, AutomationActionType::Log, 'log', 'observability'),

            // Health score: a low score notifies; every calculation is logged.
            new AutomationPolicy('health.low_score', self::E_HEALTH, AutomationActionType::Notify, 'internal', 'operations_manager', minSeverity: 'warning'),
            new AutomationPolicy('health.logged', self::E_HEALTH, AutomationActionType::Log, 'log', 'observability'),

            // Diagnostics / summaries: observability only.
            new AutomationPolicy('diagnostics.logged', self::E_DIAGNOSTICS, AutomationActionType::Log, 'log', 'observability'),
            new AutomationPolicy('summary.logged', self::E_EXEC_SUMMARY, AutomationActionType::Log, 'log', 'observability'),

            // Exceptions: a critical raise alerts; a non-critical raise notifies;
            // resolution is logged. NONE of these resolve or escalate the
            // exception itself — Operations owns that.
            new AutomationPolicy('exception.critical', self::E_EXCEPTION_RAISED, AutomationActionType::Alert, 'internal', 'operations_manager', minSeverity: 'critical'),
            new AutomationPolicy('exception.raised', self::E_EXCEPTION_RAISED, AutomationActionType::Notify, 'internal', 'zone_supervisor', minSeverity: 'warning'),
            new AutomationPolicy('exception.resolved', self::E_EXCEPTION_RESOLVED, AutomationActionType::Log, 'log', 'observability'),

            // Conflicts: a blocking conflict alerts; resolution is logged.
            new AutomationPolicy('conflict.blocking', self::E_CONFLICT_DETECTED, AutomationActionType::Alert, 'internal', 'dispatcher', minSeverity: 'critical'),
            new AutomationPolicy('conflict.detected', self::E_CONFLICT_DETECTED, AutomationActionType::Notify, 'internal', 'dispatcher', minSeverity: 'warning'),
            new AutomationPolicy('conflict.resolved', self::E_CONFLICT_RESOLVED, AutomationActionType::Log, 'log', 'observability'),
        ];
    }

    /**
     * The active policies for one event name.
     *
     * @return list<AutomationPolicy>
     */
    public function forEvent(string $eventName): array
    {
        return array_values(array_filter(
            $this->all(),
            static fn (AutomationPolicy $p) => $p->active && $p->eventName === $eventName,
        ));
    }
}
