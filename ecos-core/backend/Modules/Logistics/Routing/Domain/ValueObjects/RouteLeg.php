<?php

declare(strict_types=1);

namespace Modules\Logistics\Routing\Domain\ValueObjects;

/** One hop. A null fromStopId is the leg out of the origin depot. */
final class RouteLeg
{
    public function __construct(
        public readonly ?int $fromStopId,
        public readonly int $toStopId,
        public readonly int $sequence,
        public readonly float $distanceKm,
        public readonly int $durationMinutes,
    ) {}

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'from_stop_id' => $this->fromStopId,
            'to_stop_id' => $this->toStopId,
            'sequence' => $this->sequence,
            'distance_km' => $this->distanceKm,
            'duration_minutes' => $this->durationMinutes,
        ];
    }
}
