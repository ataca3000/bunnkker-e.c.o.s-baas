<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Operations\Loading\Application\Actions\AssignDriverAction;
use Modules\Operations\Loading\Domain\Exceptions\LoadingSessionNotFoundException;
use Modules\Operations\Loading\Domain\Models\DriverAssignment;
use Modules\Operations\Loading\Domain\Models\LoadingSession;
use Modules\Operations\Loading\Domain\Models\VehicleAssignment;
use Modules\Operations\Loading\Presentation\Http\Requests\AssignDriverRequest;
use Modules\Operations\Loading\Presentation\Http\Resources\DriverAssignmentResource;

final class DriverAssignmentController extends Controller
{
    use HasApiResponse;

    public function store(
        AssignDriverRequest $request,
        string $sessionId,
        string $assignmentId,
        AssignDriverAction $action,
    ): JsonResponse {
        $session = $this->findSession($sessionId, $request->user()->company_id);
        $this->authorize('operate', $session);

        $assignment = VehicleAssignment::where('id', $assignmentId)
            ->where('loading_session_id', $session->id)
            ->first();

        if (! $assignment) {
            abort(404, "Vehicle assignment [{$assignmentId}] not found.");
        }

        $validated = $request->validated();
        $driverAssignment = $action->execute(
            assignment: $assignment,
            driverId: $validated['driver_id'],
            driverName: $validated['driver_name'],
            assignedBy: (string) $request->user()->id,
            driverPhone: $validated['driver_phone'] ?? null,
            assignmentType: $validated['assignment_type'] ?? 'primary',
        );

        return $this->created(new DriverAssignmentResource($driverAssignment));
    }

    public function show(Request $request, string $sessionId, string $assignmentId): JsonResponse
    {
        $session = $this->findSession($sessionId, $request->user()->company_id);
        $this->authorize('view', $session);

        $assignment = VehicleAssignment::where('id', $assignmentId)
            ->where('loading_session_id', $session->id)
            ->first();

        if (! $assignment) {
            abort(404, "Vehicle assignment [{$assignmentId}] not found.");
        }

        $driverAssignment = DriverAssignment::where('vehicle_assignment_id', $assignment->id)
            ->where('status', 'assigned')
            ->first();

        if (! $driverAssignment) {
            return $this->success(null);
        }

        return $this->success(new DriverAssignmentResource($driverAssignment));
    }

    private function findSession(string $sessionId, string $companyId): LoadingSession
    {
        $session = LoadingSession::where('id', $sessionId)
            ->where('company_id', $companyId)
            ->first();

        if (! $session) {
            throw LoadingSessionNotFoundException::forId($sessionId);
        }

        return $session;
    }
}
