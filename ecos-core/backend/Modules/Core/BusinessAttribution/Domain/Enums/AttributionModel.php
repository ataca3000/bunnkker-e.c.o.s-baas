<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Domain\Enums;

enum AttributionModel: string
{
    case FirstTouch = 'first_touch';
    case LastTouch = 'last_touch';
    case Linear = 'linear';
    case PositionBased = 'position_based';
    case TimeDecay = 'time_decay';

    public function label(): string
    {
        return match ($this) {
            self::FirstTouch => 'First Touch',
            self::LastTouch => 'Last Touch',
            self::Linear => 'Linear',
            self::PositionBased => 'Position Based',
            self::TimeDecay => 'Time Decay',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::FirstTouch => '100% credit to the first touchpoint.',
            self::LastTouch => '100% credit to the last touchpoint before conversion.',
            self::Linear => 'Equal credit distributed across all touchpoints.',
            self::PositionBased => '40% to first, 40% to last, 20% shared among middle touchpoints.',
            self::TimeDecay => 'More credit to touchpoints closer in time to conversion.',
        };
    }
}
