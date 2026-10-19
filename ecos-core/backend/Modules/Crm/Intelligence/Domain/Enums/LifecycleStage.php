<?php

declare(strict_types=1);

namespace Modules\Crm\Intelligence\Domain\Enums;

/**
 * Where a customer sits in its lifecycle — derived deterministically from order
 * count and churn band, not assigned by hand.
 */
enum LifecycleStage: string
{
    case New = 'new';
    case Active = 'active';
    case Loyal = 'loyal';
    case Lapsing = 'lapsing';
    case Dormant = 'dormant';
    case Lost = 'lost';

    /**
     * @param  int  $orders  lifetime order count
     * @param  ChurnRiskBand  $churn  current churn band
     */
    public static function derive(int $orders, ChurnRiskBand $churn): self
    {
        if ($orders === 0) {
            return self::Lost;
        }

        if ($churn === ChurnRiskBand::Critical) {
            return $orders >= 2 ? self::Dormant : self::Lost;
        }

        if ($churn === ChurnRiskBand::High) {
            return self::Lapsing;
        }

        if ($orders === 1) {
            return self::New;
        }

        return $orders >= 4 ? self::Loyal : self::Active;
    }

    public function label(): string
    {
        return ucfirst($this->value);
    }
}
