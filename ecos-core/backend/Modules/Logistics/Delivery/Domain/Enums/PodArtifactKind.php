<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Domain\Enums;

enum PodArtifactKind: string
{
    case Signature = 'signature';
    case Photo = 'photo';
    case IdScan = 'id_scan';
    case Otp = 'otp';

    public function label(): string
    {
        return match ($this) {
            self::Signature => 'Signature',
            self::Photo => 'Photo',
            self::IdScan => 'ID Scan',
            self::Otp => 'OTP Confirmation',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }

    /** @return list<array{value: string, label: string}> */
    public static function options(): array
    {
        return array_map(static fn (self $c) => ['value' => $c->value, 'label' => $c->label()], self::cases());
    }
}
