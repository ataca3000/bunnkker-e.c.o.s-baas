<?php

declare(strict_types=1);

namespace Modules\Finance\Vat\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use Modules\Finance\Ledger\Domain\Models\JournalEntry;
use Modules\Finance\Vat\Domain\Enums\VatPeriodStatus;

/**
 * A VAT reporting window. Its figures are derived from the ledger; settling it
 * posts a settlement journal through the Posting Engine.
 */
class VatPeriod extends Model
{
    protected $table = 'finance_vat_periods';

    /** @var array<string, mixed> */
    protected $attributes = ['status' => 'open'];

    protected $fillable = [
        'uuid', 'company_id', 'name', 'start_date', 'end_date', 'status',
        'settlement_journal_id', 'created_by', 'settled_by', 'settled_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => VatPeriodStatus::class,
            'start_date' => 'date',
            'end_date' => 'date',
            'settled_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $row): void {
            if ($row->uuid === null) {
                $row->uuid = (string) Str::uuid();
            }
        });
    }

    public function returns(): HasMany
    {
        return $this->hasMany(VatReturn::class, 'vat_period_id');
    }

    public function settlementJournal(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class, 'settlement_journal_id');
    }

    public function isSettled(): bool
    {
        return $this->status === VatPeriodStatus::Settled;
    }
}
