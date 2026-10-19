<?php

declare(strict_types=1);

namespace Modules\Finance\Ledger\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * A reusable manual-journal skeleton. Configuration only — it posts nothing and
 * is never a ledger record; it pre-fills a draft that the Journal Engine then
 * validates and posts like any other.
 */
class JournalTemplate extends Model
{
    protected $table = 'finance_journal_templates';

    /** @var array<string, mixed> */
    protected $attributes = ['is_active' => true];

    protected $fillable = [
        'uuid', 'company_id', 'code', 'name', 'description', 'lines', 'is_active', 'created_by',
    ];

    protected function casts(): array
    {
        return ['lines' => 'array', 'is_active' => 'boolean'];
    }

    protected static function booted(): void
    {
        static::creating(function (self $t): void {
            if ($t->uuid === null) {
                $t->uuid = (string) Str::uuid();
            }
        });
    }
}
