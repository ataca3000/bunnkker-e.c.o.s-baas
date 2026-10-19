<?php

declare(strict_types=1);

namespace Modules\Commerce\Synchronization\Application\Services;

use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Commerce\Synchronization\Domain\Enums\SyncDirection;
use Modules\Commerce\Synchronization\Domain\Enums\SyncEntityType;
use Modules\Commerce\Synchronization\Domain\Enums\SyncStatus;
use Modules\Commerce\Synchronization\Domain\Models\SyncLog;

final class SyncLogService
{
    /**
     * @param  array<string, mixed>|null  $requestPayload
     */
    public function createLog(
        ?Channel $channel,
        SyncEntityType $entityType,
        SyncDirection $direction,
        string $action,
        ?string $entityId = null,
        SyncStatus $status = SyncStatus::Processing,
        ?array $requestPayload = null,
        // ── Phase B fields (all nullable for backward compatibility) ──────────
        ?string $correlationId = null,
        ?string $eventName = null,
        ?int $eventVersion = null,
        ?string $warehouseId = null,
    ): SyncLog {
        return SyncLog::create([
            'channel_id' => $channel?->id,
            'entity_type' => $entityType->value,
            'entity_id' => $entityId,
            'direction' => $direction->value,
            'action' => $action,
            'correlation_id' => $correlationId,
            'event_name' => $eventName,
            'event_version' => $eventVersion,
            'warehouse_id' => $warehouseId,
            'status' => $status->value,
            'request_payload' => $requestPayload,
            'synced_at' => now(),
        ]);
    }

    /**
     * @param  array<string, mixed>|null  $responsePayload
     */
    public function markSuccess(
        SyncLog $log,
        ?array $responsePayload = null,
        ?Channel $channel = null,
        ?int $durationMs = null,
    ): void {
        $log->update([
            'status' => SyncStatus::Success->value,
            'response_payload' => $responsePayload,
            'error_message' => null,
            'duration_ms' => $durationMs,
            'synced_at' => now(),
        ]);

        $channel?->update([
            'last_sync_at' => now(),
            'last_successful_sync_at' => now(),
        ]);
    }

    /**
     * @param  array<string, mixed>|null  $responsePayload
     */
    public function markFailed(
        SyncLog $log,
        string $errorMessage,
        ?array $responsePayload = null,
        ?Channel $channel = null,
        ?int $durationMs = null,
    ): void {
        $log->update([
            'status' => SyncStatus::Failed->value,
            'error_message' => $errorMessage,
            'response_payload' => $responsePayload,
            'duration_ms' => $durationMs,
            'synced_at' => now(),
        ]);

        $channel?->update([
            'last_error_at' => now(),
            'last_error_message' => mb_substr($errorMessage, 0, 1000),
        ]);
    }

    /**
     * Create a skipped log entry (e.g. duplicate webhook detection).
     *
     * @param  array<string, mixed>|null  $requestPayload
     */
    public function createSkippedLog(
        ?Channel $channel,
        SyncEntityType $entityType,
        SyncDirection $direction,
        string $action,
        ?string $entityId = null,
        ?array $requestPayload = null,
        ?string $correlationId = null,
    ): SyncLog {
        return SyncLog::create([
            'channel_id' => $channel?->id,
            'entity_type' => $entityType->value,
            'entity_id' => $entityId,
            'direction' => $direction->value,
            'action' => $action,
            'correlation_id' => $correlationId,
            'status' => SyncStatus::Skipped->value,
            'request_payload' => $requestPayload,
            'synced_at' => now(),
        ]);
    }
}
