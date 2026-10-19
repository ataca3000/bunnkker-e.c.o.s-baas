<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Application\Actions;

use Modules\Operations\Loading\Domain\Models\LoadingException;
use Modules\Operations\Loading\Domain\Models\LoadingSession;

final class RaiseLoadingExceptionAction
{
    public function execute(
        LoadingSession $session,
        string $exceptionType,
        string $severity,
        string $description,
        string $actorId,
        ?string $vehicleAssignmentId = null,
        ?string $entityType = null,
        ?string $entityId = null,
    ): LoadingException {
        return LoadingException::create([
            'company_id' => $session->company_id,
            'loading_session_id' => $session->id,
            'vehicle_assignment_id' => $vehicleAssignmentId,
            'exception_type' => $exceptionType,
            'severity' => $severity,
            'description' => $description,
            'status' => 'open',
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'created_by' => $actorId,
            'updated_by' => $actorId,
        ]);
    }
}
