<?php

declare(strict_types=1);

namespace Modules\Finance\Vat\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * A snapshot of a VAT period's derived figures at generation time — the filed
 * document. The live figures stay derivable from the ledger for reconciliation.
 */
class VatReturn extends Model
{
    protected $table = 'finance_vat_returns';

    /** @var array<string, mixed> */
    protected $attributes = ['status' => 'draft'];

    protected $fillable = [
        'uuid', 'company_id', 'vat_period_id', 'output_vat', 'input_vat_recoverable',
        'input_vat_non_recoverable', 'net_payable', 'status', 'notes',
        'generated_at', 'filed_at', 'filed_by',
    ];

    protected function casts(): array
    {
        return [
            'output_vat' => 'decimal:4',
            'input_vat_recoverable' => 'decimal:4',
            'input_vat_non_recoverable' => 'decimal:4',
            'net_payable' => 'decimal:4',
            'generated_at' => 'datetime',
            'filed_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $row): void {
            if ($row->uuid === null) {
                $row->uuid = (string) Str::uuid();
            }
            if ($row->generated_at === null) {
                $row->generated_at = now();
            }
        });
    }

    public function period(): BelongsTo
    {
        return $this->belongsTo(VatPeriod::class, 'vat_period_id');
    }
}
