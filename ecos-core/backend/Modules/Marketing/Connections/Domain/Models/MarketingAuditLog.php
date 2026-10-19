<?php

declare(strict_types=1);

namespace Modules\Marketing\Connections\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

final class MarketingAuditLog extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $table = 'marketing_audit_logs';

    protected $guarded = [];

    protected $casts = [
        'before' => 'array',
        'after' => 'array',
        'created_at' => 'datetime',
    ];

    /**
     * Fluent factory for audit log entries.
     *
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     */
    public static function record(
        string $entityType,
        string $entityId,
        string $action,
        ?string $actorId = null,
        ?string $actorName = null,
        array $before = [],
        array $after = [],
        ?string $reason = null,
        ?string $connectionId = null,
        ?string $assetId = null,
        ?string $connectorType = null,
    ): self {
        return self::create([
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'action' => $action,
            'actor_id' => $actorId,
            'actor_name' => $actorName,
            'before' => $before ?: null,
            'after' => $after ?: null,
            'reason' => $reason,
            'connection_id' => $connectionId,
            'asset_id' => $assetId,
            'connector_type' => $connectorType,
            'created_at' => now(),
        ]);
    }
}
