<?php

declare(strict_types=1);

namespace Modules\Marketing\Connections\Application\Services;

use Modules\Marketing\Connections\Domain\Models\MarketingAuditLog;

/**
 * Business-oriented audit logging for Marketing OS actions.
 *
 * Records WHO did WHAT to WHICH entity, with before/after state.
 * Favors business language over CRUD language in action names.
 */
final class MarketingAuditService
{
    public function logConnection(
        string $connectionId,
        string $action,       // 'connected' | 'disconnected' | 'reconnected' | 'validated'
        ?string $actorId = null,
        ?string $actorName = null,
        array $before = [],
        array $after = [],
        ?string $reason = null,
        ?string $connectorType = null,
    ): MarketingAuditLog {
        return MarketingAuditLog::record(
            entityType: 'connection',
            entityId: $connectionId,
            action: $action,
            actorId: $actorId,
            actorName: $actorName,
            before: $before,
            after: $after,
            reason: $reason,
            connectionId: $connectionId,
            connectorType: $connectorType,
        );
    }

    public function logAsset(
        string $assetId,
        string $action,        // 'discovered' | 'updated' | 'mapped' | 'unmapped' | 'health_checked'
        ?string $actorId = null,
        ?string $actorName = null,
        array $before = [],
        array $after = [],
        ?string $connectionId = null,
        ?string $connectorType = null,
    ): MarketingAuditLog {
        return MarketingAuditLog::record(
            entityType: 'asset',
            entityId: $assetId,
            action: $action,
            actorId: $actorId,
            actorName: $actorName,
            before: $before,
            after: $after,
            connectionId: $connectionId,
            assetId: $assetId,
            connectorType: $connectorType,
        );
    }

    public function logMapping(
        string $relationshipId,
        string $action,         // 'suggested' | 'accepted' | 'rejected' | 'explicit'
        string $assetId,
        ?string $actorId = null,
        ?string $actorName = null,
        ?string $reason = null,
    ): MarketingAuditLog {
        return MarketingAuditLog::record(
            entityType: 'relationship',
            entityId: $relationshipId,
            action: $action,
            actorId: $actorId,
            actorName: $actorName,
            reason: $reason,
            assetId: $assetId,
        );
    }

    /**
     * Return recent audit log entries for a given entity.
     *
     * @return \Illuminate\Database\Eloquent\Collection<int, MarketingAuditLog>
     */
    public function forEntity(string $entityType, string $entityId, int $limit = 50)
    {
        return MarketingAuditLog::where('entity_type', $entityType)
            ->where('entity_id', $entityId)
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get();
    }
}
