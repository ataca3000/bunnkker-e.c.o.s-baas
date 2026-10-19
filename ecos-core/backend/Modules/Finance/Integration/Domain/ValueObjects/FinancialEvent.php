<?php

declare(strict_types=1);

namespace Modules\Finance\Integration\Domain\ValueObjects;

use Illuminate\Support\Carbon;
use Modules\Finance\Integration\Domain\Enums\BusinessEventType;

/**
 * A normalized financial event — the single shape every operational module speaks
 * to Finance in.
 *
 * ┌─ THE ANTI-CORRUPTION BOUNDARY ──────────────────────────────────────────┐
 * │ An operational module never hands Finance its own aggregate; it hands     │
 * │ over this flat, self-describing fact: which event, which entity, when,     │
 * │ the amounts by role (net / tax / gross / cost / amount) and the analytic   │
 * │ dimensions. The posting rule reads amounts BY NAME, so a module can enrich │
 * │ the map without any rule change. The idempotency key makes the whole       │
 * │ pipeline exactly-once and safely replayable.                              │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class FinancialEvent
{
    /**
     * @param  array<string, float>  $amounts     keyed by amount source (net, tax, gross, cost, amount, …)
     * @param  array<string, mixed>  $dimensions  branch_id, cost_center_id, currency, …
     */
    public function __construct(
        public readonly string $companyId,
        public readonly BusinessEventType $eventType,
        public readonly string $sourceModule,
        public readonly ?string $entityType,
        public readonly ?string $entityId,
        public readonly array $amounts,
        public readonly Carbon $occurredAt,
        public readonly string $idempotencyKey,
        public readonly array $dimensions = [],
        public readonly string $currency = 'EGP',
        public readonly ?int $actorId = null,
        public readonly ?string $reference = null,
        public readonly ?string $description = null,
    ) {}

    /** The amount for a named source, or 0 when the module did not supply it. */
    public function amount(string $source): float
    {
        return round((float) ($this->amounts[$source] ?? 0.0), 4);
    }

    public function branchId(): ?string
    {
        $b = $this->dimensions['branch_id'] ?? null;

        return $b !== null ? (string) $b : null;
    }

    public function costCenterId(): ?int
    {
        $c = $this->dimensions['cost_center_id'] ?? null;

        return $c !== null ? (int) $c : null;
    }

    /**
     * The class of stock this movement concerned, as stated by the publisher.
     *
     * Finance treats it as an opaque token: it selects an account role and is
     * never interpreted, never mapped back to a product, never looked up. Null
     * means the event made no claim, which for a rule that needs one is a
     * refusal rather than an invitation to pick a default.
     */
    public function inventoryClass(): ?string
    {
        $c = $this->dimensions['inventory_class'] ?? null;

        return is_string($c) && $c !== '' ? $c : null;
    }

    public function eventCode(): string
    {
        return $this->eventType->value;
    }

    /** @return array<string, mixed> A snapshot for the audit / dead-letter record. */
    public function toArray(): array
    {
        return [
            'company_id' => $this->companyId,
            'event_type' => $this->eventType->value,
            'source_module' => $this->sourceModule,
            'entity_type' => $this->entityType,
            'entity_id' => $this->entityId,
            'amounts' => $this->amounts,
            'dimensions' => $this->dimensions,
            'currency' => $this->currency,
            'occurred_at' => $this->occurredAt->toIso8601String(),
            'idempotency_key' => $this->idempotencyKey,
            'actor_id' => $this->actorId,
            'reference' => $this->reference,
            'description' => $this->description,
        ];
    }

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        return new self(
            companyId: (string) $data['company_id'],
            eventType: BusinessEventType::from((string) $data['event_type']),
            sourceModule: (string) $data['source_module'],
            entityType: $data['entity_type'] ?? null,
            entityId: isset($data['entity_id']) ? (string) $data['entity_id'] : null,
            amounts: $data['amounts'] ?? [],
            occurredAt: Carbon::parse($data['occurred_at']),
            idempotencyKey: (string) $data['idempotency_key'],
            dimensions: $data['dimensions'] ?? [],
            currency: (string) ($data['currency'] ?? 'EGP'),
            actorId: isset($data['actor_id']) ? (int) $data['actor_id'] : null,
            reference: $data['reference'] ?? null,
            description: $data['description'] ?? null,
        );
    }
}
