<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Domain\ValueObjects;

use Carbon\Carbon;

final readonly class TimestampContext
{
    public function __construct(
        /** When the business action actually happened */
        public Carbon $businessTimestamp,
        /** When this reconstruction was triggered */
        public Carbon $replayTimestamp,
        /** Wall-clock "now" */
        public Carbon $currentTimestamp,
        /** The target point-in-time for historical queries (null = current) */
        public ?Carbon $historicalView = null,
    ) {}

    public static function now(): self
    {
        $now = Carbon::now();

        return new self(
            businessTimestamp: $now->copy(),
            replayTimestamp: $now->copy(),
            currentTimestamp: $now->copy(),
            historicalView: null,
        );
    }

    public static function at(Carbon $asOf): self
    {
        return new self(
            businessTimestamp: $asOf->copy(),
            replayTimestamp: Carbon::now(),
            currentTimestamp: Carbon::now(),
            historicalView: $asOf->copy(),
        );
    }

    public function isHistorical(): bool
    {
        return $this->historicalView !== null;
    }

    /** Returns historicalView when set, otherwise currentTimestamp. */
    public function effectiveTimestamp(): Carbon
    {
        return $this->historicalView ?? $this->currentTimestamp;
    }

    public function toArray(): array
    {
        return [
            'business_timestamp' => $this->businessTimestamp->toIso8601String(),
            'replay_timestamp' => $this->replayTimestamp->toIso8601String(),
            'current_timestamp' => $this->currentTimestamp->toIso8601String(),
            'historical_view' => $this->historicalView?->toIso8601String(),
            'is_historical' => $this->isHistorical(),
        ];
    }
}
