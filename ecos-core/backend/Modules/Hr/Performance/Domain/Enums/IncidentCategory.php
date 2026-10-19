<?php

declare(strict_types=1);

namespace Modules\Hr\Performance\Domain\Enums;

/** What kind of operational incident is being recorded. */
enum IncidentCategory: string
{
    case Reward = 'reward';
    case Penalty = 'penalty';
    case CustomerComplaint = 'customer_complaint';
    case CustomerAppreciation = 'customer_appreciation';
    case InventoryDamage = 'inventory_damage';
    case InventoryShortage = 'inventory_shortage';
    case Warning = 'warning';
    case OperationalNote = 'operational_note';

    /** Incidents that reflect well on the person. */
    public function isPositive(): bool
    {
        return in_array($this, [self::Reward, self::CustomerAppreciation], true);
    }

    /** Incidents that may justify money coming off pay — a decision, never automatic. */
    public function mayJustifyDeduction(): bool
    {
        return in_array($this, [
            self::Penalty, self::InventoryDamage, self::InventoryShortage,
        ], true);
    }

    /** Incidents that may justify a bonus. */
    public function mayJustifyBonus(): bool
    {
        return $this->isPositive();
    }

    /** Which module the evidence usually comes from. */
    public function typicalModule(): ?string
    {
        return match ($this) {
            self::CustomerComplaint, self::CustomerAppreciation => 'crm',
            self::InventoryDamage, self::InventoryShortage => 'inventory',
            default => null,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Reward => 'Reward',
            self::Penalty => 'Penalty',
            self::CustomerComplaint => 'Customer Complaint',
            self::CustomerAppreciation => 'Customer Appreciation',
            self::InventoryDamage => 'Inventory Damage',
            self::InventoryShortage => 'Inventory Shortage',
            self::Warning => 'Warning',
            self::OperationalNote => 'Operational Note',
        };
    }
}
