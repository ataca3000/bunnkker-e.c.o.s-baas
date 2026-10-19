<?php

declare(strict_types=1);

namespace Modules\Commerce\Synchronization\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Commerce\Synchronization\Domain\Enums\SyncDirection;
use Modules\Commerce\Synchronization\Domain\Enums\SyncEntityType;
use Modules\Commerce\Synchronization\Domain\Enums\SyncStatus;

/**
 * @property string $id
 * @property string|null $channel_id
 * @property SyncEntityType $entity_type
 * @property string|null $entity_id
 * @property SyncDirection $direction
 * @property string|null $action
 * @property string|null $correlation_id
 * @property string|null $event_name
 * @property int|null $event_version
 * @property string|null $warehouse_id
 * @property int|null $duration_ms
 * @property SyncStatus $status
 * @property array<string, mixed>|null $request_payload
 * @property array<string, mixed>|null $response_payload
 * @property string|null $error_message
 * @property \Illuminate\Support\Carbon|null $synced_at
 */
class SyncLog extends Model
{
    use HasUuids;

    protected $table = 'sync_logs';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'channel_id',
        'entity_type',
        'entity_id',
        'direction',
        'action',
        'correlation_id',
        'event_name',
        'event_version',
        'warehouse_id',
        'duration_ms',
        'status',
        'request_payload',
        'response_payload',
        'error_message',
        'synced_at',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'entity_type' => SyncEntityType::class,
            'direction' => SyncDirection::class,
            'status' => SyncStatus::class,
            'request_payload' => 'array',
            'response_payload' => 'array',
            'synced_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Channel, $this> */
    public function channel(): BelongsTo
    {
        return $this->belongsTo(Channel::class);
    }
}
