<?php

declare(strict_types=1);

namespace Modules\Logistics\Routing\Domain\ValueObjects;

/**
 * A coordinate. Shared vocabulary between Routing and (later) Telemetry.
 *
 * Coordinates come from D1's nullable latitude/longitude on logistics_cities —
 * the single approved additive extension to a V1 table. A stop whose city has
 * no coordinate yields null, and every strategy must tolerate that rather than
 * assuming a point exists.
 */
final class GeoPoint
{
    private function __construct(
        public readonly float $latitude,
        public readonly float $longitude,
    ) {}

    public static function make(float $latitude, float $longitude): self
    {
        return new self($latitude, $longitude);
    }

    /** Null in, null out — an un-geocoded place is normal, not an error. */
    public static function fromNullable(mixed $latitude, mixed $longitude): ?self
    {
        if ($latitude === null || $longitude === null) {
            return null;
        }

        $lat = (float) $latitude;
        $lng = (float) $longitude;

        if ($lat < -90.0 || $lat > 90.0 || $lng < -180.0 || $lng > 180.0) {
            return null;
        }

        return new self($lat, $lng);
    }

    /**
     * Great-circle distance in kilometres (haversine).
     *
     * Deterministic and dependency-free, which is what the purity contract
     * requires of anything a strategy may call.
     */
    public function distanceTo(self $other): float
    {
        $earthRadiusKm = 6371.0;

        $dLat = deg2rad($other->latitude - $this->latitude);
        $dLng = deg2rad($other->longitude - $this->longitude);

        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($this->latitude)) * cos(deg2rad($other->latitude)) * sin($dLng / 2) ** 2;

        return round($earthRadiusKm * 2 * atan2(sqrt($a), sqrt(1 - $a)), 3);
    }

    /** @return array{latitude: float, longitude: float} */
    public function toArray(): array
    {
        return ['latitude' => $this->latitude, 'longitude' => $this->longitude];
    }
}
