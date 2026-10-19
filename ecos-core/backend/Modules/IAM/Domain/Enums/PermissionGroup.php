<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Enums;

/**
 * PermissionGroup — the canonical, code-level catalog of permission groups
 * (TASK-IAM-002 / ADR-038, Part 3).
 *
 * This enum is the single source of truth for the fourteen top-level groups. The
 * `permission_groups` table is seeded FROM this enum (see PermissionGroupSeeder),
 * never the other way round, so a group can be added without a data migration.
 *
 * Phase 1 = infrastructure only: this defines the groups; it does NOT assign any
 * existing permission to a group.
 */
enum PermissionGroup: string
{
    case ADMINISTRATION = 'administration';
    case INVENTORY = 'inventory';
    case PURCHASING = 'purchasing';
    case MANUFACTURING = 'manufacturing';
    case PREPARATION = 'preparation';
    case PACKING = 'packing';
    case SHIPPING = 'shipping';
    case COMMERCE = 'commerce';
    case CRM = 'crm';
    case MARKETING = 'marketing';
    case ACCOUNTING = 'accounting';
    case FINANCE = 'finance';
    case REPORTS = 'reports';
    case AI_PLATFORM = 'ai_platform';

    public function label(): string
    {
        return match ($this) {
            self::ADMINISTRATION => 'Administration',
            self::INVENTORY => 'Inventory',
            self::PURCHASING => 'Purchasing',
            self::MANUFACTURING => 'Manufacturing',
            self::PREPARATION => 'Preparation',
            self::PACKING => 'Packing',
            self::SHIPPING => 'Shipping',
            self::COMMERCE => 'Commerce',
            self::CRM => 'CRM',
            self::MARKETING => 'Marketing',
            self::ACCOUNTING => 'Accounting',
            self::FINANCE => 'Finance',
            self::REPORTS => 'Reports',
            self::AI_PLATFORM => 'AI Platform',
        };
    }

    public function icon(): string
    {
        return match ($this) {
            self::ADMINISTRATION => 'shield',
            self::INVENTORY => 'package',
            self::PURCHASING => 'shopping-cart',
            self::MANUFACTURING => 'factory',
            self::PREPARATION => 'clipboard-list',
            self::PACKING => 'box',
            self::SHIPPING => 'truck',
            self::COMMERCE => 'store',
            self::CRM => 'users',
            self::MARKETING => 'megaphone',
            self::ACCOUNTING => 'calculator',
            self::FINANCE => 'banknote',
            self::REPORTS => 'bar-chart',
            self::AI_PLATFORM => 'sparkles',
        };
    }

    /**
     * Stable display order, spaced by 10 to allow future insertions.
     */
    public function sortOrder(): int
    {
        return (array_search($this, self::cases(), true) + 1) * 10;
    }

    /**
     * Reference-data shape used to seed the `permission_groups` table.
     *
     * @return list<array{code: string, name: string, icon: string, sort_order: int}>
     */
    public static function definitions(): array
    {
        return array_map(static fn (self $group): array => [
            'code' => $group->value,
            'name' => $group->label(),
            'icon' => $group->icon(),
            'sort_order' => $group->sortOrder(),
        ], self::cases());
    }
}
