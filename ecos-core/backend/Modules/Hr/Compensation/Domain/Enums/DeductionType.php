<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Enums;

/**
 * Why money is being taken off someone's pay.
 *
 * Two of these originate in Attendance (unpaid leave, unauthorised absence) and
 * two in Inventory (shortage, damage) — but HR never reaches into those modules
 * for them. Attendance answers through a port; Inventory liabilities arrive as a
 * decision carrying an opaque reference to the document that prompted it.
 */
enum DeductionType: string
{
    case UnpaidLeave = 'unpaid_leave';
    case UnauthorizedAbsence = 'unauthorized_absence';
    case AdministrativePenalty = 'administrative_penalty';
    case InventoryShortage = 'inventory_shortage';
    case InventoryDamage = 'inventory_damage';
    case Manual = 'manual';

    /** Derived from attendance records rather than entered by hand. */
    public function isAttendanceDerived(): bool
    {
        return in_array($this, [self::UnpaidLeave, self::UnauthorizedAbsence], true);
    }

    /** Recovers a loss the company carried — Inventory owns the discrepancy itself. */
    public function isInventoryLiability(): bool
    {
        return in_array($this, [self::InventoryShortage, self::InventoryDamage], true);
    }

    /** Which module the originating document belongs to, when there is one. */
    public function sourceModule(): ?string
    {
        return match (true) {
            $this->isAttendanceDerived() => 'attendance',
            $this->isInventoryLiability() => 'inventory',
            default => null,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::UnpaidLeave => 'Salary Deduction Leave',
            self::UnauthorizedAbsence => 'Unauthorized Absence',
            self::AdministrativePenalty => 'Administrative Penalty',
            self::InventoryShortage => 'Missing Inventory Liability',
            self::InventoryDamage => 'Damaged Inventory Liability',
            self::Manual => 'Manual Administrative Deduction',
        };
    }
}
