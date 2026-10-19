<?php

declare(strict_types=1);

namespace Modules\Finance\Payables\Domain\Enums;

/**
 * The lifecycle of a supplier payment.
 *
 * Unlike a receipt (money in), a payment (money out) carries an APPROVAL step:
 * draft → approved → posted. The maker creates the draft; a different checker
 * approves it; only then may it post to the ledger. Void cancels a pre-posting
 * payment.
 */
enum PaymentStatus: string
{
    case Draft = 'draft';
    case Approved = 'approved';
    case Posted = 'posted';
    case Void = 'void';

    public function isDraft(): bool
    {
        return $this === self::Draft;
    }

    public function isApproved(): bool
    {
        return $this === self::Approved;
    }

    public function isPosted(): bool
    {
        return $this === self::Posted;
    }

    public function isVoid(): bool
    {
        return $this === self::Void;
    }

    public function label(): string
    {
        return ucfirst($this->value);
    }
}
