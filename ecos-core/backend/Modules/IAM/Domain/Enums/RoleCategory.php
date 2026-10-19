<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Enums;

/**
 * Business categories a Role Template belongs to (TASK-IAM-003 / ADR-039).
 * Organisational grouping for the Role Library — not a security primitive.
 */
enum RoleCategory: string
{
    case EXECUTIVE = 'executive';
    case MANAGEMENT = 'management';
    case OPERATIONS = 'operations';
    case WAREHOUSE = 'warehouse';
    case MANUFACTURING = 'manufacturing';
    case SALES = 'sales';
    case CUSTOMER_SERVICE = 'customer_service';
    case FINANCE = 'finance';
    case ACCOUNTING = 'accounting';
    case HR = 'hr';
    case MARKETING = 'marketing';
    case COMMERCE = 'commerce';
    case SHIPPING = 'shipping';
    case ADMINISTRATION = 'administration';
    case IT = 'it';
    case AI_PLATFORM = 'ai_platform';
    case CUSTOM = 'custom';

    public function label(): string
    {
        return match ($this) {
            self::EXECUTIVE => 'Executive',
            self::MANAGEMENT => 'Management',
            self::OPERATIONS => 'Operations',
            self::WAREHOUSE => 'Warehouse',
            self::MANUFACTURING => 'Manufacturing',
            self::SALES => 'Sales',
            self::CUSTOMER_SERVICE => 'Customer Service',
            self::FINANCE => 'Finance',
            self::ACCOUNTING => 'Accounting',
            self::HR => 'HR',
            self::MARKETING => 'Marketing',
            self::COMMERCE => 'Commerce',
            self::SHIPPING => 'Shipping',
            self::ADMINISTRATION => 'Administration',
            self::IT => 'IT',
            self::AI_PLATFORM => 'AI Platform',
            self::CUSTOM => 'Custom',
        };
    }

    /** @return list<array{value:string,label:string}> */
    public static function options(): array
    {
        return array_map(
            static fn (self $c): array => ['value' => $c->value, 'label' => $c->label()],
            self::cases(),
        );
    }
}
