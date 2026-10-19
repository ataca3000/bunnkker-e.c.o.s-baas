<?php

declare(strict_types=1);

namespace Modules\Logistics\Routing\Domain\ValueObjects;

/**
 * One stop inside a route request.
 *
 * A projection of Distribution's DeliveryStop — the address, customer and order
 * stay in V1. Routing carries only what sequencing needs.
 */
final class RouteStop
{
    public function __construct(
        public readonly int $stopId,
        public readonly ?GeoPoint $point = null,
        public readonly ?string $zoneId = null,
        public readonly ?string $cityId = null,
        public readonly ?string $postcode = null,
        /**
         * A stop that has already been attempted. Frozen stops keep their
         * position: a reroute re-plans the REMAINDER and never rewrites
         * history.
         */
        public readonly bool $isFrozen = false,
        public readonly int $sequenceHint = 0,
        public readonly ?int $serviceMinutes = null,
    ) {}

    public function hasPoint(): bool
    {
        return $this->point !== null;
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'stop_id' => $this->stopId,
            'point' => $this->point?->toArray(),
            'zone_id' => $this->zoneId,
            'city_id' => $this->cityId,
            'postcode' => $this->postcode,
            'is_frozen' => $this->isFrozen,
            'sequence_hint' => $this->sequenceHint,
            'service_minutes' => $this->serviceMinutes,
        ];
    }
}
