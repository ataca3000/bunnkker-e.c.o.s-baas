<?php

declare(strict_types=1);

namespace Modules\Finance\Budget\Domain\Enums;

/**
 * The analytic dimension a budget line (and its actuals) is measured on.
 * "company" is the whole-entity line; the rest scope to a department, branch,
 * cost center or project. Project support is ready — the dimension exists and
 * flows through the same matching.
 */
enum BudgetDimension: string
{
    case Company = 'company';
    case Department = 'department';
    case Branch = 'branch';
    case CostCenter = 'cost_center';
    case Project = 'project';

    /** The journal-line column this dimension matches actuals on, if any. */
    public function ledgerColumn(): ?string
    {
        return match ($this) {
            self::Branch => 'branch_id',
            self::CostCenter => 'cost_center_id',
            self::Project => 'project_id',
            default => null, // company/department are not ledger-line columns
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }
}
