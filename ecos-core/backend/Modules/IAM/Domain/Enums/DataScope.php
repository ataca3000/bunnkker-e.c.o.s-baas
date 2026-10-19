<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Enums;

/**
 * DataScope — the record-level reach of a permission grant (TASK-IAM-002 / ADR-038, Part 3).
 *
 * The scope is a property of the grant (role_permissions.data_scope). ALL is the
 * default and preserves current behaviour (no filtering). New organization units
 * (region, business unit, department, cost centre, …) are added here without any
 * schema redesign — the resolver reads a `scope_descriptor` bag for the exotic ones.
 */
enum DataScope: string
{
    case SELF = 'self';
    case TEAM = 'team';
    case BRANCH = 'branch';
    case WAREHOUSE = 'warehouse';
    case CHANNEL = 'channel';
    case COMPANY = 'company';
    case REGION = 'region';
    case BUSINESS_UNIT = 'business_unit';
    case DEPARTMENT = 'department';
    case CUSTOM = 'custom';
    case ALL = 'all';

    public function label(): string
    {
        return ucwords(str_replace('_', ' ', $this->value));
    }

    /**
     * ALL means "no data restriction" — the resolver returns an unrestricted constraint.
     */
    public function isUnrestricted(): bool
    {
        return $this === self::ALL;
    }

    public static function default(): self
    {
        return self::ALL;
    }
}
