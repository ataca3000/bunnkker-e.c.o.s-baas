<?php

declare(strict_types=1);

namespace Modules\Finance\Reporting\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * A snapshot of a generated executive report — a reproducible, export-ready
 * picture of the read models at a moment in time. It holds derived data only and
 * never affects the ledger.
 */
class ReportSnapshot extends Model
{
    protected $table = 'finance_report_snapshots';

    protected $fillable = [
        'uuid', 'company_id', 'report_type', 'title', 'period_from', 'period_to',
        'payload', 'generated_by', 'generated_at',
    ];

    protected function casts(): array
    {
        return [
            'period_from' => 'date',
            'period_to' => 'date',
            'payload' => 'array',
            'generated_at' => 'datetime',
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

        // A snapshot is an immutable archive record.
        static::updating(static fn (): bool => false);
    }
}
