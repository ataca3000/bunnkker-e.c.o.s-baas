<?php

declare(strict_types=1);

namespace Modules\Finance\Ledger\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * A cost center — a financial dimension that tags journal lines for
 * responsibility analysis. Never a ledger of its own.
 */
class CostCenter extends Model
{
    protected $table = 'finance_cost_centers';

    /** @var array<string, mixed> */
    protected $attributes = ['is_active' => true];

    protected $fillable = [
        'uuid', 'company_id', 'code', 'name', 'name_ar', 'parent_id', 'is_active', 'created_by',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    protected static function booted(): void
    {
        static::creating(function (self $cc): void {
            if ($cc->uuid === null) {
                $cc->uuid = (string) Str::uuid();
            }
        });
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }
}
