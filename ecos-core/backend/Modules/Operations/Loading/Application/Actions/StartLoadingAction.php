<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Application\Actions;

use Illuminate\Support\Facades\DB;
use Modules\Operations\Loading\Domain\Enums\LoadingSessionStatus;
use Modules\Operations\Loading\Domain\Exceptions\InvalidLoadingSessionStatusTransitionException;
use Modules\Operations\Loading\Domain\Models\LoadingSession;

final class StartLoadingAction
{
    public function execute(LoadingSession $session, string $actorId): LoadingSession
    {
        $status = $session->status instanceof LoadingSessionStatus
            ? $session->status
            : LoadingSessionStatus::from($session->status);

        if ($status !== LoadingSessionStatus::Ready) {
            throw InvalidLoadingSessionStatusTransitionException::from(
                $status,
                LoadingSessionStatus::Loading,
            );
        }

        return DB::transaction(function () use ($session, $actorId): LoadingSession {
            $session->update([
                'status' => LoadingSessionStatus::Loading->value,
                'loading_started_at' => now(),
                'loading_started_by' => $actorId,
                'updated_by' => $actorId,
            ]);

            return $session->fresh() ?? $session;
        });
    }
}
