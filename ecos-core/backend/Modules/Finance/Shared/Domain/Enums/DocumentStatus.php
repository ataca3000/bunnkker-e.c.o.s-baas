<?php

declare(strict_types=1);

namespace Modules\Finance\Shared\Domain\Enums;

/**
 * The lifecycle of a subledger document that posts in one step (invoices, bills,
 * receipts). A draft is editable and has NOT touched the ledger; posting is the
 * one-way gate to an immutable, GL-linked document; void is a pre-posting
 * cancellation. Posted documents are never edited — corrections are notes or
 * reversals.
 */
enum DocumentStatus: string
{
    case Draft = 'draft';
    case Posted = 'posted';
    case Void = 'void';

    public function isDraft(): bool
    {
        return $this === self::Draft;
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
