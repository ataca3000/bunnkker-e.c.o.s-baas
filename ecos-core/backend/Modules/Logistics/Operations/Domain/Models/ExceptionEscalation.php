<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * A hand-off up the chain, with the reason attached.
 *
 * Append-only: an escalation that can be edited afterwards lets the record be
 * tidied into agreeing with whatever happened next.
 */
class ExceptionEscalation extends Model
{
    public const TRIGGER_MANUAL = 'manual';

    public const TRIGGER_TIMEOUT = 'unacknowledged_timeout';

    public const TRIGGER_SEVERITY = 'severity_increase';

    protected $table = 'ops_exception_escalations';

    /** @var array<string, mixed> */
    protected $attributes = [
        'trigger' => self::TRIGGER_MANUAL,
    ];

    protected $fillable = [
        'uuid', 'company_id', 'exception_id',
        'level', 'escalated_to_role', 'escalated_to_user_id',
        'reason', 'trigger',
        'escalated_at', 'escalated_by', 'escalated_by_name',
        'acknowledged_at', 'acknowledged_by',
    ];

    protected function casts(): array
    {
        return [
            'level' => 'integer',
            'escalated_at' => 'datetime',
            'acknowledged_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $escalation): void {
            if ($escalation->uuid === null) {
                $escalation->uuid = (string) Str::uuid();
            }

            if ($escalation->escalated_at === null) {
                $escalation->escalated_at = now();
            }
        });

        static::deleting(static fn () => false);
    }

    public function exception(): BelongsTo
    {
        return $this->belongsTo(OperationalException::class, 'exception_id');
    }

    public function wasAutomatic(): bool
    {
        return $this->trigger !== self::TRIGGER_MANUAL;
    }
}
