<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Application\Actions;

use Modules\Operations\Loading\Domain\Enums\LoadingExceptionStatus;
use Modules\Operations\Loading\Domain\Models\LoadingException;
use RuntimeException;

final class ResolveLoadingExceptionAction
{
    public function execute(
        LoadingException $exception,
        string $actorId,
        string $resolutionNotes,
    ): LoadingException {
        $status = $exception->status instanceof LoadingExceptionStatus
            ? $exception->status
            : LoadingExceptionStatus::from($exception->status);

        $resolvableStatuses = [
            LoadingExceptionStatus::Open,
            LoadingExceptionStatus::Investigating,
        ];

        if (! in_array($status, $resolvableStatuses, true)) {
            throw new RuntimeException(
                "Cannot resolve loading exception: status must be 'open' or 'investigating', current status is '{$status->value}'.",
            );
        }

        $exception->update([
            'status' => LoadingExceptionStatus::Resolved->value,
            'resolved_at' => now(),
            'resolved_by' => $actorId,
            'resolution_notes' => $resolutionNotes,
            'updated_by' => $actorId,
        ]);

        return $exception->fresh() ?? $exception;
    }
}
