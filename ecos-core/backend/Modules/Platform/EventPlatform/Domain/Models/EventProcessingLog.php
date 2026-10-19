<?php

declare(strict_types=1);

namespace Modules\Platform\EventPlatform\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Modules\Platform\EventPlatform\Domain\Enums\ProcessingStatus;

/**
 * @property string $id
 * @property string $event_id
 * @property string $subscriber_class
 * @property string $idempotency_key
 * @property ProcessingStatus $status
 * @property int $attempt_number
 * @property string|null $error_message
 * @property string|null $processed_at
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class EventProcessingLog extends Model
{
    protected $table = 'enterprise_event_processing_log';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $primaryKey = 'id';

    protected $fillable = [
        'id',
        'event_id',
        'subscriber_class',
        'idempotency_key',
        'status',
        'attempt_number',
        'error_message',
        'processed_at',
    ];

    protected $casts = [
        'status' => ProcessingStatus::class,
        'attempt_number' => 'integer',
    ];
}
