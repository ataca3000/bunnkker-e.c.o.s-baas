<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Domain\Enums;

enum Season: string
{
    case Ramadan = 'ramadan';
    case Summer = 'summer';
    case BlackFriday = 'black_friday';
    case Winter = 'winter';
    case MothersDay = 'mothers_day';
    case EidAlFitr = 'eid_al_fitr';
    case EidAlAdha = 'eid_al_adha';
    case NewYear = 'new_year';
    case BackToSchool = 'back_to_school';
    case Custom = 'custom';

    public function label(): string
    {
        return match ($this) {
            self::Ramadan => 'Ramadan',
            self::Summer => 'Summer',
            self::BlackFriday => 'Black Friday',
            self::Winter => 'Winter',
            self::MothersDay => "Mother's Day",
            self::EidAlFitr => 'Eid Al-Fitr',
            self::EidAlAdha => 'Eid Al-Adha',
            self::NewYear => 'New Year',
            self::BackToSchool => 'Back to School',
            self::Custom => 'Custom',
        };
    }
}
