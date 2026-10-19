<?php

declare(strict_types=1);

namespace Modules\Finance\Budget\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use Modules\Finance\Budget\Domain\Enums\BudgetStatus;
use Modules\Finance\Fiscal\Domain\Models\FiscalYear;

/**
 * A budget — a fiscal-year plan with a version and scenario, following a draft →
 * approved workflow. It never affects the ledger; it is the baseline the control
 * engine compares actuals against.
 */
class Budget extends Model
{
    protected $table = 'finance_budgets';

    /** @var array<string, mixed> */
    protected $attributes = ['status' => 'draft', 'version' => 'v1', 'scenario' => 'base', 'currency' => 'EGP'];

    protected $fillable = [
        'uuid', 'company_id', 'fiscal_year_id', 'name', 'version', 'scenario',
        'status', 'currency', 'description', 'created_by', 'approved_by', 'approved_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => BudgetStatus::class,
            'approved_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $budget): void {
            if ($budget->uuid === null) {
                $budget->uuid = (string) Str::uuid();
            }
        });

        // An approved budget's lines are frozen; edits require a new version.
        static::deleting(static fn (self $budget): bool => $budget->status === BudgetStatus::Draft);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(BudgetLine::class, 'budget_id');
    }

    public function year(): BelongsTo
    {
        return $this->belongsTo(FiscalYear::class, 'fiscal_year_id');
    }

    public function isApproved(): bool
    {
        return $this->status === BudgetStatus::Approved;
    }

    public function total(): float
    {
        return round((float) $this->lines()->sum('amount'), 4);
    }
}
