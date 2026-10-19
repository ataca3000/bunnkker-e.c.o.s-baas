<?php

declare(strict_types=1);

namespace Modules\Crm\Engagement\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Modules\Crm\Engagement\Domain\Enums\ActivityDirection;
use Modules\Crm\Engagement\Domain\Enums\ActivityType;

/**
 * A CRM-owned interaction — one immutable row in the append-only activity log.
 *
 * ┌─ APPEND-ONLY · THE TIMELINE NEVER REWRITES HISTORY ─────────────────────┐
 * │ Once logged, an activity is never edited or deleted; a correction is a new  │
 * │ activity. This is what makes the customer timeline a faithful, append-only  │
 * │ record of every interaction the CRM captured.                              │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class CustomerActivity extends Model
{
    use HasUuids;

    protected $table = 'crm_customer_activities';

    protected $fillable = [
        'company_id', 'customer_id', 'activity_type', 'direction', 'channel',
        'subject', 'body', 'outcome', 'occurred_at', 'related_type', 'related_id', 'metadata', 'actor_id',
    ];

    protected function casts(): array
    {
        return [
            'activity_type' => ActivityType::class,
            'direction' => ActivityDirection::class,
            'occurred_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    protected static function booted(): void
    {
        // Append-only: the interaction log is immutable.
        static::updating(static fn (): bool => false);
        static::deleting(static fn (): bool => false);
    }
}
