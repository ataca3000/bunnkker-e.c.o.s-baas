<?php

declare(strict_types=1);

namespace Modules\Logistics\Automation\Domain\ValueObjects;

/**
 * A domain event, normalised into the one shape the automation layer reasons
 * about.
 *
 * Immutable scalars only — the consumed domain events already carry scalars, and
 * this preserves that: a policy can be evaluated and a notification raised
 * without any database access or model reload.
 */
final class AutomationEvent
{
    private const SEVERITY_RANK = ['critical' => 3, 'warning' => 2, 'info' => 1];

    /**
     * @param  array<string, mixed>  $payload
     */
    public function __construct(
        public readonly string $name,
        public readonly string $severity,
        public readonly ?string $status,
        public readonly ?string $companyId,
        public readonly string $occurredAt,
        public readonly array $payload = [],
    ) {}

    public function severityRank(): int
    {
        return self::SEVERITY_RANK[$this->severity] ?? 0;
    }

    public function severityAtLeast(string $floor): bool
    {
        return $this->severityRank() >= (self::SEVERITY_RANK[$floor] ?? 0);
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'name' => $this->name,
            'severity' => $this->severity,
            'status' => $this->status,
            'company_id' => $this->companyId,
            'occurred_at' => $this->occurredAt,
            'payload' => $this->payload,
        ];
    }
}
