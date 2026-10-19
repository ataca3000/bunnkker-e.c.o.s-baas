<?php

declare(strict_types=1);

namespace Modules\Logistics\Intelligence\Domain\ValueObjects;

use Modules\Logistics\Intelligence\Domain\Enums\RecommendationSeverity;

/**
 * A single, immutable piece of decision support.
 *
 * ┌─ EVIDENCE, NOT AUTHORITY ───────────────────────────────────────────────┐
 * │ A recommendation is a SUGGESTION derived from figures the owning modules │
 * │ already produced. It never acts, never writes, and never overrides an    │
 * │ authority — acting on it means calling the owning module's own endpoint. │
 * │                                                                          │
 * │ Every recommendation carries its rationale (the ordered reasons it was   │
 * │ raised) so a human can see WHY before doing anything — the                │
 * │ verdict-with-reasons contract, applied to intelligence.                  │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Readonly throughout: the priority is assigned by re-deriving a new instance,
 * so a recommendation can never be mutated after it is raised.
 */
final class Recommendation
{
    /**
     * @param  list<string>  $rationale
     */
    public function __construct(
        public readonly string $type,
        public readonly string $category,
        public readonly RecommendationSeverity $severity,
        public readonly string $title,
        public readonly string $detail,
        public readonly string $action,
        public readonly string $sourceModule,
        public readonly array $rationale = [],
        public readonly ?string $impact = null,
        public readonly int $priority = 0,
    ) {}

    /** A copy with its computed priority — the priority engine's only mutation. */
    public function withPriority(int $priority): self
    {
        return new self(
            $this->type,
            $this->category,
            $this->severity,
            $this->title,
            $this->detail,
            $this->action,
            $this->sourceModule,
            $this->rationale,
            $this->impact,
            $priority,
        );
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'type' => $this->type,
            'category' => $this->category,
            'severity' => $this->severity->value,
            'severity_label' => $this->severity->label(),
            'title' => $this->title,
            'detail' => $this->detail,
            // Acting on a recommendation means calling the owning module — the
            // suggested action names it, but never performs it.
            'action' => $this->action,
            'source_module' => $this->sourceModule,
            'rationale' => $this->rationale,
            'impact' => $this->impact,
            'priority' => $this->priority,
        ];
    }
}
