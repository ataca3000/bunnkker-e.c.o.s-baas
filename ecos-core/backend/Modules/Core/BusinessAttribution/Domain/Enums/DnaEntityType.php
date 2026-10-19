<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Domain\Enums;

enum DnaEntityType: string
{
    case Lead = 'lead';
    case Conversation = 'conversation';
    case Customer = 'customer';
    case Order = 'order';
    case Invoice = 'invoice';
    case Payment = 'payment';
    case Shipment = 'shipment';
    case Return_ = 'return';
    case ManufacturingOrder = 'manufacturing_order';
    case PreparationBatch = 'preparation_batch';
    case PackingBatch = 'packing_batch';

    public function label(): string
    {
        return match ($this) {
            self::Lead => 'Lead',
            self::Conversation => 'Conversation',
            self::Customer => 'Customer',
            self::Order => 'Order',
            self::Invoice => 'Invoice',
            self::Payment => 'Payment',
            self::Shipment => 'Shipment',
            self::Return_ => 'Return',
            self::ManufacturingOrder => 'Manufacturing Order',
            self::PreparationBatch => 'Preparation Batch',
            self::PackingBatch => 'Packing Batch',
        };
    }
}
