<?php

declare(strict_types=1);

namespace Modules\Logistics\Routing\Domain\ValueObjects;

/**
 * What a strategy returns: pure data, no side effects.
 *
 * A proposal that violates a hard constraint is STILL RETURNED, with the
 * violation attached, so a dispatcher can see WHY no clean answer exists rather
 * than receiving nothing. An optimiser that quietly drops a constraint to
 * produce a pretty answer is worse than one that reports it cannot.
 */
final class RouteProposal
{
    /**
     * @param  list<RouteLeg>  $legs
     * @param  list<int>  $sequence  Stop ids in visit order
     * @param  list<string>  $violations
     */
    public function __construct(
        public readonly array $sequence,
        public readonly array $legs,
        public readonly float $totalDistanceKm,
        public readonly int $totalDurationMinutes,
        public readonly array $violations = [],
        public readonly float $confidence = 1.0,
    ) {}

    public function stopCount(): int
    {
        return count($this->sequence);
    }

    public function isClean(): bool
    {
        return $this->violations === [];
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'sequence' => $this->sequence,
            'total_distance_km' => $this->totalDistanceKm,
            'total_duration_minutes' => $this->totalDurationMinutes,
            'stop_count' => $this->stopCount(),
            'violations' => $this->violations,
            'confidence' => $this->confidence,
            'legs' => array_map(static fn (RouteLeg $l) => $l->toArray(), $this->legs),
        ];
    }
}
