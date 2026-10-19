<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Domain\Enums;

enum JourneyStage: string
{
    case AdImpression = 'ad_impression';
    case AdClick = 'ad_click';
    case Landing = 'landing';
    case Conversation = 'conversation';
    case Lead = 'lead';
    case LeadAssignment = 'lead_assignment';
    case Quote = 'quote';
    case Order = 'order';
    case Payment = 'payment';
    case InventoryReservation = 'inventory_reservation';
    case Manufacturing = 'manufacturing';
    case Preparation = 'preparation';
    case Packing = 'packing';
    case Shipment = 'shipment';
    case Delivery = 'delivery';
    case CustomerReview = 'customer_review';
    case RepeatPurchase = 'repeat_purchase';
    case VipCustomer = 'vip_customer';

    public function label(): string
    {
        return match ($this) {
            self::AdImpression => 'Ad Impression',
            self::AdClick => 'Ad Click',
            self::Landing => 'Landing',
            self::Conversation => 'Conversation',
            self::Lead => 'Lead',
            self::LeadAssignment => 'Lead Assignment',
            self::Quote => 'Quote',
            self::Order => 'Order',
            self::Payment => 'Payment',
            self::InventoryReservation => 'Inventory Reservation',
            self::Manufacturing => 'Manufacturing',
            self::Preparation => 'Preparation',
            self::Packing => 'Packing',
            self::Shipment => 'Shipment',
            self::Delivery => 'Delivery',
            self::CustomerReview => 'Customer Review',
            self::RepeatPurchase => 'Repeat Purchase',
            self::VipCustomer => 'VIP Customer',
        };
    }

    /** Ordinal position in the default journey (lower = earlier). */
    public function ordinal(): int
    {
        return match ($this) {
            self::AdImpression => 1,
            self::AdClick => 2,
            self::Landing => 3,
            self::Conversation => 4,
            self::Lead => 5,
            self::LeadAssignment => 6,
            self::Quote => 7,
            self::Order => 8,
            self::Payment => 9,
            self::InventoryReservation => 10,
            self::Manufacturing => 11,
            self::Preparation => 12,
            self::Packing => 13,
            self::Shipment => 14,
            self::Delivery => 15,
            self::CustomerReview => 16,
            self::RepeatPurchase => 17,
            self::VipCustomer => 18,
        };
    }
}
