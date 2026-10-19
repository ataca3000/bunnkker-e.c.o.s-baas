<?php

declare(strict_types=1);

namespace Modules\Manufacturing\DecisionKernel\Domain\ValueObjects;

/**
 * Generic, immutable data bag that carries domain context into the kernel.
 *
 * The kernel has zero knowledge of Order, Product, Inventory, etc.
 * Callers embed their domain-specific data under typed string keys.
 *
 * Future context types (illustrative — not exhaustive):
 *   "manufacturing" → shortage_qty, product_id, allow_negative_stock
 *   "fulfillment"   → order_id, reserved_qty, available_qty
 *   "procurement"   → supplier_id, lead_time_days, reorder_point
 *   "ai"            → recommendation_score, model_version
 *
 * Immutable builder pattern: `with()` returns a new instance.
 */
final readonly class DecisionContext
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function __construct(
        /** Identifies the domain that produced this context (e.g. "manufacturing"). */
        public string $context_type,

        private array $data = [],
    ) {}

    /** Returns a new context with the given key set. Never mutates $this. */
    public function with(string $key, mixed $value): self
    {
        return new self($this->context_type, [...$this->data, $key => $value]);
    }

    public function get(string $key, mixed $default = null): mixed
    {
        return array_key_exists($key, $this->data) ? $this->data[$key] : $default;
    }

    public function has(string $key): bool
    {
        return array_key_exists($key, $this->data);
    }

    /** @return array<string, mixed> */
    public function all(): array
    {
        return $this->data;
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'context_type' => $this->context_type,
            'data' => $this->data,
        ];
    }
}
