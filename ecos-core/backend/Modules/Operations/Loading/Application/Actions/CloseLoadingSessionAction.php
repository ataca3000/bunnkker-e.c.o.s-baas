<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Application\Actions;

use Illuminate\Support\Facades\DB;
use Modules\Operations\Loading\Domain\Enums\LoadingSessionStatus;
use Modules\Operations\Loading\Domain\Events\LoadingSessionClosed;
use Modules\Operations\Loading\Domain\Exceptions\InvalidLoadingSessionStatusTransitionException;
use Modules\Operations\Loading\Domain\Models\LoadingSession;
use RuntimeException;

final class CloseLoadingSessionAction
{
    public function execute(LoadingSession $session, string $actorId): LoadingSession
    {
        $status = $session->status instanceof LoadingSessionStatus
            ? $session->status
            : LoadingSessionStatus::from($session->status);

        $allowedStatuses = [
            LoadingSessionStatus::Dispatched,
            LoadingSessionStatus::Reconciling,
        ];

        if (! in_array($status, $allowedStatuses, true)) {
            throw InvalidLoadingSessionStatusTransitionException::from(
                $status,
                LoadingSessionStatus::Closed,
            );
        }

        return DB::transaction(function () use ($session, $actorId): LoadingSession {
            $nonFinalCount = $session->vehicleAssignments()
                ->whereNotIn('status', ['reconciled', 'cancelled'])
                ->count();

            if ($nonFinalCount > 0) {
                throw new RuntimeException(
                    "Cannot close session '{$session->session_number}': {$nonFinalCount} vehicle assignment(s) are not yet reconciled or cancelled.",
                );
            }

            $totalVehicles = $session->vehicleAssignments()->count();

            $session->update([
                'status' => LoadingSessionStatus::Closed->value,
                'updated_by' => $actorId,
            ]);

            event(new LoadingSessionClosed(
                companyId: $session->company_id,
                sessionId: $session->id,
                sessionNumber: $session->session_number,
                totalVehicles: $totalVehicles,
                actorId: $actorId,
                occurredAt: now()->toIso8601String(),
            ));

            return $session->fresh() ?? $session;
        });
    }
}
