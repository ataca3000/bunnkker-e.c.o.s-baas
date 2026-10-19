<?php

declare(strict_types=1);

namespace Modules\Finance\Tax\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * A concrete tax rate applied to a transaction (e.g. VAT 14%), naming the input
 * and output GL accounts it posts to. The VAT foundation — ETA e-invoicing is
 * out of F1 scope.
 */
class TaxCode extends Model
{
    protected $table = 'finance_tax_codes';

    /** @var array<string, mixed> */
    protected $attributes = [
        'tax_type' => 'vat',
        'rate' => 0,
        'is_recoverable' => true,
        'is_active' => true,
    ];

    protected $fillable = [
        'uuid', 'company_id', 'tax_category_id', 'code', 'name',
        'tax_type', 'rate', 'is_recoverable',
        'input_account_id', 'output_account_id', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'rate' => 'decimal:4',
            'is_recoverable' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $code): void {
            if ($code->uuid === null) {
                $code->uuid = (string) Str::uuid();
            }
        });
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(TaxCategory::class, 'tax_category_id');
    }

    /** The tax amount for a base value at this rate. */
    public function taxFor(float $base): float
    {
        return round($base * ((float) $this->rate / 100), 4);
    }
}
