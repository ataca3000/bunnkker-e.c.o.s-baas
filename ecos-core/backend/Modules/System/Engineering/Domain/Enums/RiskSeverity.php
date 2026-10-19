<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Domain\Enums;

enum RiskSeverity: string
{
    case Critical      = 'critical';
    case High          = 'high';
    case Medium        = 'medium';
    case Low           = 'low';
    case Informational = 'informational';

    public function score(): int
    {
        return match($this) {
            self::Critical      => 5,
            self::High          => 4,
            self::Medium        => 3,
            self::Low           => 2,
            self::Informational => 1,
        };
    }

    public function isBlocking(): bool
    {
        return $this === self::Critical;
    }

    public function priority(): int
    {
        return match($this) {
            self::Critical      => 1,
            self::High          => 2,
            self::Medium        => 3,
            self::Low           => 4,
            self::Informational => 5,
        };
    }
}
