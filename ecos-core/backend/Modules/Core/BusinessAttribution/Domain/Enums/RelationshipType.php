<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Domain\Enums;

enum RelationshipType: string
{
    case Generated = 'GENERATED';
    case Created = 'CREATED';
    case AssignedTo = 'ASSIGNED_TO';
    case Purchased = 'PURCHASED';
    case PromotedBy = 'PROMOTED_BY';
    case ShippedBy = 'SHIPPED_BY';
    case BelongsTo = 'BELONGS_TO';
    case ConvertedTo = 'CONVERTED_TO';
    case OwnedBy = 'OWNED_BY';
    case InfluencedBy = 'INFLUENCED_BY';

    public function label(): string
    {
        return match ($this) {
            self::Generated => 'Generated',
            self::Created => 'Created',
            self::AssignedTo => 'Assigned To',
            self::Purchased => 'Purchased',
            self::PromotedBy => 'Promoted By',
            self::ShippedBy => 'Shipped By',
            self::BelongsTo => 'Belongs To',
            self::ConvertedTo => 'Converted To',
            self::OwnedBy => 'Owned By',
            self::InfluencedBy => 'Influenced By',
        };
    }
}
