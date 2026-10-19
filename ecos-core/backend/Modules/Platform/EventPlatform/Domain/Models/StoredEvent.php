<?php

declare(strict_types=1);

namespace Modules\Platform\EventPlatform\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Modules\Platform\EventPlatform\Domain\Enums\EventStatus;

/**
 * @property string $id
 * @property string $event_id
 * @property string $event_name
 * @property string $version
 * @property string $occurred_at
 * @property string $correlation_id
 * @property string|null $causation_id
 * @property string|null $company_id
 * @property string|null $warehouse_id
 * @property string|null $module
 * @property string|null $aggregate_type
 * @property string|null $aggregate_id
 * @property array $payload
 * @property array $metadata
 * @property int $retry_count
 * @property bool $is_replay
 * @property string|null $trace_id
 * @property EventStatus $status
 * @property string|null $event_class
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class StoredEvent extends Model
{
    protected $table = 'enterprise_events';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $primaryKey = 'id';

    protected $fillable = [
        'id',
        'event_id',
        'event_name',
        'version',
        'occurred_at',
        'correlation_id',
        'causation_id',
        'company_id',
        'warehouse_id',
        'module',
        'aggregate_type',
        'aggregate_id',
        'payload',
        'metadata',
        'retry_count',
        'is_replay',
        'trace_id',
        'status',
        'event_class',
    ];

    protected $casts = [
        'payload' => 'array',
        'metadata' => 'array',
        'is_replay' => 'boolean',
        'retry_count' => 'integer',
        'status' => EventStatus::class,
    ];
}
