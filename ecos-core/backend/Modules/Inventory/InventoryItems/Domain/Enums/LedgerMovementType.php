<?php

declare(strict_types=1);

namespace Modules\Inventory\InventoryItems\Domain\Enums;

enum LedgerMovementType: string
{
    case PurchaseReceipt = 'purchase_receipt';
    case SalesIssue = 'sales_issue';
    case Reservation = 'reservation';
    case ReservationRelease = 'reservation_release';
    case AdjustmentIn = 'adjustment_in';
    case AdjustmentOut = 'adjustment_out';
    case TransferIn = 'transfer_in';
    case TransferOut = 'transfer_out';
    case DirectIssue = 'direct_issue';
    case ProductionConsumption = 'production_consumption';
    case ProductionOutput = 'production_output';
    case DisassemblyConsumption = 'disassembly_consumption';
    case DisassemblyOutput = 'disassembly_output';

    public function label(): string
    {
        return match ($this) {
            self::PurchaseReceipt => 'Purchase Receipt',
            self::SalesIssue => 'Sales Issue',
            self::Reservation => 'Reservation',
            self::ReservationRelease => 'Reservation Release',
            self::AdjustmentIn => 'Adjustment In',
            self::AdjustmentOut => 'Adjustment Out',
            self::TransferIn => 'Transfer In',
            self::TransferOut => 'Transfer Out',
            self::DirectIssue => 'Direct Issue',
            self::ProductionConsumption => 'Production Consumption',
            self::ProductionOutput => 'Production Output',
            self::DisassemblyConsumption => 'Disassembly Consumption',
            self::DisassemblyOutput => 'Disassembly Output',
        };
    }

    public function affectsOnHand(): bool
    {
        return in_array($this, [
            self::PurchaseReceipt,
            self::SalesIssue,
            self::AdjustmentIn,
            self::AdjustmentOut,
            self::TransferIn,
            self::TransferOut,
            self::DirectIssue,
            self::ProductionConsumption,
            self::ProductionOutput,
            self::DisassemblyConsumption,
            self::DisassemblyOutput,
        ], true);
    }

    public function affectsReserved(): bool
    {
        return in_array($this, [
            self::Reservation,
            self::ReservationRelease,
            self::SalesIssue,
        ], true);
    }
}
