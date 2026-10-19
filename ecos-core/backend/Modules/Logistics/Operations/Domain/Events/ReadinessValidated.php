<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * A cross-module readiness validation was performed, and here is its verdict.
 *
 * ┌─ NOTIFICATION ONLY ─────────────────────────────────────────────────────┐
 * │ This event carries the RESULT of a validation that already happened. It  │
 * │ holds immutable scalars — no model, no service, no query — so a consumer │
 * │ (Observability, the AI Platform, Workflow Automation) can react to it    │
 * │ without this class ever touching the database or running logic.          │
 * │                                                                          │
 * │ Dispatching it changes nothing: no listener here executes business       │
 * │ logic, and the operation's outcome is identical whether or not anyone    │
 * │ is listening (ADR-011).                                                  │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class ReadinessValidated
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly string $overallStatus,
        public readonly int $readyCount,
        public readonly int $degradedCount,
        public readonly int $notReadyCount,
        public readonly ?string $companyId,
        public readonly string $occurredAt,
    ) {}
}
