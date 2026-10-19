<?php

declare(strict_types=1);

namespace Modules\Crm\Service\Domain\Enums;

/**
 * The kind of service case. Returns (RMA) and warranty requests are CASES the
 * CRM owns — the actual stock return or refund is executed by Inventory/Finance
 * and referenced by id; the CRM never owns that business data.
 */
enum TicketType: string
{
    case Ticket = 'ticket';
    case Complaint = 'complaint';
    case ServiceRequest = 'service_request';
    case ReturnRma = 'return_rma';
    case Warranty = 'warranty';

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }

    public function label(): string
    {
        return ucwords(str_replace('_', ' ', $this->value));
    }
}
