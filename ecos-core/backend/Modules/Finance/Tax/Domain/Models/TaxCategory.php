<?php

declare(strict_types=1);

namespace Modules\Finance\Tax\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * A tax classification (Standard VAT, Zero-rated, Exempt, Withholding, …) and
 * whether input tax under it is recoverable.
 */
class TaxCategory extends Model
{
    protected $table = 'finance_tax_categories';

    /** @var array<string, mixed> */
    protected $attributes = ['is_recoverable' => true, 'is_active' => true];

    protected $fillable = [
        'uuid', 'company_id', 'code', 'name', 'name_ar', 'is_recoverable', 'is_active',
    ];

    protected function casts(): array
    {
        return ['is_recoverable' => 'boolean', 'is_active' => 'boolean'];
    }

    protected static function booted(): void
    {
        static::creating(function (self $c): void {
            if ($c->uuid === null) {
                $c->uuid = (string) Str::uuid();
            }
        });
    }

    public function codes(): HasMany
    {
        return $this->hasMany(TaxCode::class, 'tax_category_id');
    }
}
