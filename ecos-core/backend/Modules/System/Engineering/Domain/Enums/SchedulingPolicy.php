<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Enums;

enum SchedulingPolicy: string
{
    case FIFO             = 'fifo';
    case Priority         = 'priority';
    case WeightedPriority = 'weighted_priority';
    case ManualOverride   = 'manual_override';
    case ResourceAware    = 'resource_aware';
    case DependencyAware  = 'dependency_aware';
    case Reserved         = 'reserved';

    public function label(): string
    {
        return match($this) {
            self::FIFO             => 'First In First Out',
            self::Priority         => 'Priority',
            self::WeightedPriority => 'Weighted Priority',
            self::ManualOverride   => 'Manual Override',
            self::ResourceAware    => 'Resource Aware',
            self::DependencyAware  => 'Dependency Aware',
            self::Reserved         => 'Reserved Worker',
        };
    }

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
