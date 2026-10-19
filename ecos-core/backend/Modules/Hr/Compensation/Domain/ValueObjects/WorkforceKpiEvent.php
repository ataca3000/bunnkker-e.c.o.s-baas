<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\ValueObjects;

use Illuminate\Support\Carbon;
use Modules\Hr\Compensation\Domain\Enums\KpiMetric;

/**
 * The one shape every operational module speaks to HR in.
 *
 * ┌─ THE ANTI-CORRUPTION BOUNDARY FOR THE WORKFORCE ────────────────────────┐
 * │ Commerce never hands HR an order, Shipping never hands it a shipment.      │
 * │ Each hands over this flat, self-describing fact: who did it, which metric  │
 * │ it moved, by how much, when, and an opaque reference back to the document. │
 * │                                                                            │
 * │ HR therefore imports nothing from any operational module — the metric key  │
 * │ is the entire contract. The idempotency key makes ingestion exactly-once   │
 * │ and the whole stream safely replayable.                                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class WorkforceKpiEvent
{
    public function __construct(
        public readonly string $companyId,
        public readonly KpiMetric $metric,
        public readonly ?string $employeeId,
        public readonly float $value,
        public readonly float $quantity,
        public readonly Carbon $occurredAt,
        public readonly string $idempotencyKey,
        public readonly ?string $departmentId = null,
        public readonly ?string $sourceReference = null,
        public readonly ?string $dimensionKey = null,
        public readonly ?string $dimensionValue = null,
        public readonly array $metadata = [],
    ) {}

    public function sourceModule(): string
    {
        return $this->metric->sourceModule();
    }

    /** @return array<string, mixed> the row this fact becomes */
    public function toFact(): array
    {
        return [
            'company_id' => $this->companyId,
            'employee_id' => $this->employeeId,
            'department_id' => $this->departmentId,
            'source_module' => $this->sourceModule(),
            'metric_key' => $this->metric->value,
            'value' => round($this->value, 4),
            'quantity' => round($this->quantity, 4),
            'dimension_key' => $this->dimensionKey,
            'dimension_value' => $this->dimensionValue,
            'occurred_at' => $this->occurredAt,
            'source_reference' => $this->sourceReference,
            'idempotency_key' => $this->idempotencyKey,
            'metadata' => $this->metadata === [] ? null : $this->metadata,
        ];
    }
}
