<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Application\Actions;

use Illuminate\Support\Facades\DB;
use Modules\Operations\Loading\Domain\Enums\LoadingSessionStatus;
use Modules\Operations\Loading\Domain\Events\LoadingSessionCancelled;
use Modules\Operations\Loading\Domain\Exceptions\LoadingSessionCancelledException;
use Modules\Operations\Loading\Domain\Models\LoadingSession;

final class CancelLoadingSessionAction
{
    public function execute(
        LoadingSession $session,
        string $actorId,
        string $reason,
    ): LoadingSession {
        $status = $session->status instanceof LoadingSessionStatus
            ? $session->status
            : LoadingSessionStatus::from($session->status);

        if ($status->isTerminal()) {
            throw LoadingSessionCancelledException::forSession($session->session_number);
        }

        return DB::transaction(function () use ($session, $actorId, $reason): LoadingSession {
            $session->update([
                'status' => LoadingSessionStatus::Cancelled->value,
                'cancelled_at' => now(),
                'cancelled_by' => $actorId,
                'cancellation_reason' => $reason,
                'updated_by' => $actorId,
            ]);

            event(new LoadingSessionCancelled(
                companyId: $session->company_id,
                sessionId: $session->id,
                sessionNumber: $session->session_number,
                reason: $reason,
                actorId: $actorId,
                occurredAt: now()->toIso8601String(),
            ));

            return $session->fresh() ?? $session;
        });
    }
}
