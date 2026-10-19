<?php

declare(strict_types=1);

namespace Modules\Finance\Budget\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use Modules\Finance\Budget\Domain\Enums\BudgetDimension;

/**
 * A budget commitment (encumbrance): budget reserved before it becomes an actual.
 * Availability = budget − actual − committed. Releasing flips the status; the
 * amount is never mutated.
 */
class BudgetCommitment extends Model
{
    protected $table = 'finance_budget_commitments';

    /** @var array<string, mixed> */
    protected $attributes = ['dimension_type' => 'company', 'status' => 'committed'];

    protected $fillable = [
        'uuid', 'company_id', 'budget_id', 'account_id', 'dimension_type', 'dimension_id',
        'period_number', 'amount', 'source_type', 'source_id', 'reference',
        'status', 'committed_by', 'committed_at', 'released_at',
    ];

    protected function casts(): array
    {
        return [
            'dimension_type' => BudgetDimension::class,
            'period_number' => 'integer',
            'amount' => 'decimal:4',
            'committed_at' => 'datetime',
            'released_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $row): void {
            if ($row->uuid === null) {
                $row->uuid = (string) Str::uuid();
            }
            if ($row->committed_at === null) {
                $row->committed_at = now();
            }
        });
    }

    public function isCommitted(): bool
    {
        return $this->status === 'committed';
    }
}
