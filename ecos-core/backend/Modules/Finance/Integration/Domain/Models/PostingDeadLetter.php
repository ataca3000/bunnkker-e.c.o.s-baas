<?php

declare(strict_types=1);

namespace Modules\Finance\Integration\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * A financial event that could not post. It carries the full event payload so it
 * can be replayed once the cause (a missing account-role mapping, a closed
 * period) is fixed — and because the payload keeps its idempotency key, the
 * replay can never double-post.
 */
class PostingDeadLetter extends Model
{
    protected $table = 'finance_posting_dead_letters';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => 'pending',
        'attempts' => 1,
    ];

    protected $fillable = [
        'uuid', 'company_id', 'source_module', 'event_code', 'source_entity_type',
        'source_entity_id', 'source_event_id', 'payload', 'error', 'attempts',
        'status', 'last_attempt_at', 'resolved_at', 'resolved_by',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'attempts' => 'integer',
            'last_attempt_at' => 'datetime',
            'resolved_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $letter): void {
            if ($letter->uuid === null) {
                $letter->uuid = (string) Str::uuid();
            }
        });
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }
}
