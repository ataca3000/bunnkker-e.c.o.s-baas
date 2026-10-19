<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseMaterials\Domain\Enums;

enum PurchaseMaterialStatus: string
{
    // ── Workflow states ────────────────────────────────────────────────────
    case Draft = 'draft';
    case UnderReview = 'under_review';
    case WaitingSupplierSelection = 'waiting_supplier_selection';
    case Approved = 'approved';
    case Purchasing = 'purchasing';
    case Receiving = 'receiving';
    case Completed = 'completed';

    // ── Exception states ───────────────────────────────────────────────────
    case Rejected = 'rejected';
    case OnHold = 'on_hold';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::UnderReview => 'Under Review',
            self::WaitingSupplierSelection => 'Waiting Supplier Selection',
            self::Approved => 'Approved',
            self::Purchasing => 'Purchasing',
            self::Receiving => 'Receiving',
            self::Completed => 'Completed',
            self::Rejected => 'Rejected',
            self::OnHold => 'On Hold',
            self::Cancelled => 'Cancelled',
        };
    }

    public function isEditable(): bool
    {
        return in_array($this, [self::Draft, self::OnHold], true);
    }

    public function canSubmit(): bool
    {
        return $this === self::Draft;
    }

    public function canApprove(): bool
    {
        return $this === self::WaitingSupplierSelection;
    }

    public function canReject(): bool
    {
        return in_array($this, [self::UnderReview, self::WaitingSupplierSelection], true);
    }

    public function canHold(): bool
    {
        return in_array($this, [
            self::Draft,
            self::UnderReview,
            self::WaitingSupplierSelection,
            self::Approved,
        ], true);
    }

    public function canCancel(): bool
    {
        return in_array($this, [
            self::Draft,
            self::UnderReview,
            self::WaitingSupplierSelection,
            self::OnHold,
        ], true);
    }

    /** Move to the next workflow state. Returns null if no forward transition. */
    public function nextWorkflowState(): ?self
    {
        return match ($this) {
            self::Draft => self::UnderReview,
            self::UnderReview => self::WaitingSupplierSelection,
            self::WaitingSupplierSelection => self::Approved,
            self::Approved => self::Purchasing,
            self::Purchasing => self::Receiving,
            self::Receiving => self::Completed,
            default => null,
        };
    }
}
