<?php

declare(strict_types=1);

namespace Modules\Platform\EventPlatform\Domain\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property string $id
 * @property string $stored_event_id
 * @property string $event_id
 * @property string $event_name
 * @property string $subscriber_class
 * @property string $failure_reason
 * @property string|null $stack_trace
 * @property array $event_payload
 * @property array $event_metadata
 * @property string $occurred_at
 * @property int $retry_count
 * @property string $dlq_status
 * @property string|null $company_id
 * @property string|null $replayed_at
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class DeadLetterEntry extends Model
{
    protected $table = 'enterprise_dead_letter_queue';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $primaryKey = 'id';

    protected $fillable = [
        'id',
        'stored_event_id',
        'event_id',
        'event_name',
        'subscriber_class',
        'failure_reason',
        'stack_trace',
        'event_payload',
        'event_metadata',
        'occurred_at',
        'retry_count',
        'dlq_status',
        'company_id',
        'replayed_at',
    ];

    protected $casts = [
        'event_payload' => 'array',
        'event_metadata' => 'array',
        'retry_count' => 'integer',
    ];
}
