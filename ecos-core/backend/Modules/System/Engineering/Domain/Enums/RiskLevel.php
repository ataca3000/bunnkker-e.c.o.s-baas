<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Domain\Enums;
enum RiskLevel: string {
    case Critical = 'critical';
    case High     = 'high';
    case Medium   = 'medium';
    case Low      = 'low';
    case Minimal  = 'minimal';

    public function score(): int {
        return match($this) {
            self::Critical => 100,
            self::High     => 75,
            self::Medium   => 50,
            self::Low      => 25,
            self::Minimal  => 5,
        };
    }
}
