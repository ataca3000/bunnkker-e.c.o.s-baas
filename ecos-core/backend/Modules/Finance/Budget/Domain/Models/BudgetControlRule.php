<?php

declare(strict_types=1);

namespace Modules\Finance\Budget\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * A budget control rule — the warn/block consumption thresholds the control
 * engine evaluates. Advisory configuration; the engine reads it and returns a
 * verdict, it never posts or mutates a budget.
 */
class BudgetControlRule extends Model
{
    protected $table = 'finance_budget_control_rules';

    /** @var array<string, mixed> */
    protected $attributes = [
        'scope' => 'global',
        'warn_threshold_pct' => 90,
        'block_threshold_pct' => 100,
        'action' => 'warn',
        'is_active' => true,
    ];

    protected $fillable = [
        'uuid', 'company_id', 'scope', 'account_id', 'dimension_type', 'dimension_id',
        'warn_threshold_pct', 'block_threshold_pct', 'action', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'warn_threshold_pct' => 'decimal:2',
            'block_threshold_pct' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $rule): void {
            if ($rule->uuid === null) {
                $rule->uuid = (string) Str::uuid();
            }
        });
    }
}
