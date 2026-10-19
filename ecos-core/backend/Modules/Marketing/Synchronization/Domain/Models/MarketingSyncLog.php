<?php

declare(strict_types=1);

namespace Modules\Marketing\Synchronization\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Marketing\Connections\Domain\Models\MarketingConnection;
use Modules\Marketing\Synchronization\Domain\Enums\SyncStatus;
use Modules\Marketing\Synchronization\Domain\Enums\SyncType;

/**
 * @property string $id
 * @property string $marketing_connection_id
 * @property SyncType $sync_type
 * @property SyncStatus $status
 * @property int $assets_discovered
 * @property int $assets_created
 * @property int $assets_updated
 * @property int $assets_failed
 * @property \Carbon\Carbon|null $started_at
 * @property \Carbon\Carbon|null $completed_at
 * @property string|null $triggered_by
 * @property string|null $error_message
 * @property array|null $sync_metadata
 */
class MarketingSyncLog extends Model
{
    use HasUuids;

    protected $table = 'marketing_sync_logs';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'marketing_connection_id',
        'sync_type',
        'status',
        'assets_discovered',
        'assets_created',
        'assets_updated',
        'assets_failed',
        'started_at',
        'completed_at',
        'triggered_by',
        'error_message',
        'sync_metadata',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'sync_type' => SyncType::class,
            'status' => SyncStatus::class,
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'sync_metadata' => 'array',
        ];
    }

    public function durationSeconds(): ?int
    {
        if ($this->started_at === null || $this->completed_at === null) {
            return null;
        }

        return (int) $this->completed_at->diffInSeconds($this->started_at);
    }

    /** @return BelongsTo<MarketingConnection, $this> */
    public function connection(): BelongsTo
    {
        return $this->belongsTo(MarketingConnection::class, 'marketing_connection_id');
    }
}
