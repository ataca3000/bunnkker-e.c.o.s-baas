<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Application\Actions;

use Illuminate\Support\Facades\DB;
use Modules\Operations\Loading\Domain\Enums\LoadingSessionStatus;
use Modules\Operations\Loading\Domain\Exceptions\InvalidLoadingSessionStatusTransitionException;
use Modules\Operations\Loading\Domain\Models\LoadingSession;

final class StartAllocationAction
{
    public function __construct(
        private readonly AllocatePoolToSessionAction $allocate,
    ) {}

    public function execute(LoadingSession $session, string $actorId): LoadingSession
    {
        $status = $session->status instanceof LoadingSessionStatus
            ? $session->status
            : LoadingSessionStatus::from($session->status);

        if ($status !== LoadingSessionStatus::LoadingComplete) {
            throw InvalidLoadingSessionStatusTransitionException::from(
                $status,
                LoadingSessionStatus::Allocating,
            );
        }

        return DB::transaction(function () use ($session, $actorId): LoadingSession {
            $session->update([
                'status' => LoadingSessionStatus::Allocating->value,
                'allocation_started_at' => now(),
                'updated_by' => $actorId,
            ]);

            $fresh = $session->fresh() ?? $session;

            // Auto-create AllocationRecords for every vehicle assignment in this session.
            // Derives orders from the preparation wave(s) that produced the loaded products,
            // matches order lines to VehicleInventoryItems, and records the system decision.
            // Idempotent — re-runs are safe (existing records are skipped).
            $this->allocate->execute($fresh, $actorId);

            return $fresh->fresh() ?? $fresh;
        });
    }
}
