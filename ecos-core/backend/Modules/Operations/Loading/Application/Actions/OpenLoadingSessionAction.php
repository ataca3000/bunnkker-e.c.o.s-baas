<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Application\Actions;

use Illuminate\Support\Facades\DB;
use Modules\Operations\Loading\Domain\Enums\LoadingSessionStatus;
use Modules\Operations\Loading\Domain\Exceptions\InvalidLoadingSessionStatusTransitionException;
use Modules\Operations\Loading\Domain\Models\LoadingSession;

final class OpenLoadingSessionAction
{
    public function execute(LoadingSession $session, string $actorId): LoadingSession
    {
        $status = $session->status instanceof LoadingSessionStatus
            ? $session->status
            : LoadingSessionStatus::from($session->status);

        if ($status !== LoadingSessionStatus::Draft) {
            throw InvalidLoadingSessionStatusTransitionException::from(
                $status,
                LoadingSessionStatus::Ready,
            );
        }

        return DB::transaction(function () use ($session, $actorId): LoadingSession {
            $session->update([
                'status' => LoadingSessionStatus::Ready->value,
                'updated_by' => $actorId,
            ]);

            return $session->fresh() ?? $session;
        });
    }
}
