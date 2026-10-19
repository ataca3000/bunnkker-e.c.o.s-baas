<?php

declare(strict_types=1);

namespace Modules\Finance\Closing\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;
use Modules\Finance\Closing\Domain\Enums\CheckStatus;

/**
 * One check a closing run must clear. A blocking item that is not passed prevents
 * the close.
 */
class ClosingChecklistItem extends Model
{
    protected $table = 'finance_closing_checklist_items';

    /** @var array<string, mixed> */
    protected $attributes = ['status' => 'pending', 'is_blocking' => true, 'category' => 'general'];

    protected $fillable = [
        'uuid', 'closing_run_id', 'key', 'label', 'category',
        'status', 'is_blocking', 'detail', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'status' => CheckStatus::class,
            'is_blocking' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $item): void {
            if ($item->uuid === null) {
                $item->uuid = (string) Str::uuid();
            }
        });
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(ClosingRun::class, 'closing_run_id');
    }
}
