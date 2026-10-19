<?php

declare(strict_types=1);

namespace Modules\Finance\Fiscal\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use Modules\Finance\Fiscal\Domain\Enums\FiscalYearStatus;

/**
 * A fiscal year — the outer calendar boundary for its periods.
 */
class FiscalYear extends Model
{
    protected $table = 'finance_fiscal_years';

    /** @var array<string, mixed> */
    protected $attributes = ['status' => FiscalYearStatus::Open->value];

    protected $fillable = [
        'uuid', 'company_id', 'name', 'start_date', 'end_date',
        'status', 'closed_at', 'locked_at', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'status' => FiscalYearStatus::class,
            'start_date' => 'date',
            'end_date' => 'date',
            'closed_at' => 'datetime',
            'locked_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $year): void {
            if ($year->uuid === null) {
                $year->uuid = (string) Str::uuid();
            }
        });
    }

    public function periods(): HasMany
    {
        return $this->hasMany(FiscalPeriod::class, 'fiscal_year_id');
    }

    public function isOpen(): bool
    {
        return $this->status === FiscalYearStatus::Open;
    }
}
