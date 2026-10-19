<?php

declare(strict_types=1);

namespace Modules\Crm\Sales\Domain\Enums;

/** A quote's lifecycle: draft → sent → accepted / rejected / expired. */
enum QuoteStatus: string
{
    case Draft = 'draft';
    case Sent = 'sent';
    case Accepted = 'accepted';
    case Rejected = 'rejected';
    case Expired = 'expired';

    public function isEditable(): bool
    {
        return $this === self::Draft;
    }
}
