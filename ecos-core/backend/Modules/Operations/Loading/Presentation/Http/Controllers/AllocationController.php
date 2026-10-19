<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use BackedEnum;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Operations\Loading\Application\Actions\CompleteAllocationAction;
use Modules\Operations\Loading\Application\Actions\StartAllocationAction;
use Modules\Operations\Loading\Domain\Exceptions\LoadingSessionNotFoundException;
use Modules\Operations\Loading\Domain\Models\AllocationRecord;
use Modules\Operations\Loading\Domain\Models\LoadingSession;
use Modules\Operations\Loading\Domain\Models\VehicleAssignment;
use Modules\Operations\Loading\Domain\Services\AllocationDecisionChainService;
use Modules\Operations\Loading\Presentation\Http\Requests\OverrideAllocationRequest;
use Modules\Operations\Loading\Presentation\Http\Resources\AllocationRecordResource;

final class AllocationController extends Controller
{
    use HasApiResponse;

    public function index(Request $request, string $sessionId, string $assignmentId): JsonResponse
    {
        $session = $this->findSession($sessionId, $request->user()->company_id);
        $this->authorize('allocate', $session);

        $assignment = VehicleAssignment::where('id', $assignmentId)
            ->where('loading_session_id', $session->id)
            ->first();

        if (! $assignment) {
            abort(404, "Vehicle assignment [{$assignmentId}] not found.");
        }

        $records = AllocationRecord::where('vehicle_assignment_id', $assignment->id)
            ->orderBy('priority_rank')
            ->get();

        return $this->success(AllocationRecordResource::collection($records));
    }

    public function startAllocation(
        Request $request,
        string $sessionId,
        StartAllocationAction $action,
    ): JsonResponse {
        $session = $this->findSession($sessionId, $request->user()->company_id);
        $this->authorize('allocate', $session);

        $result = $action->execute($session, (string) $request->user()->id);

        return $this->success([
            'id' => $result->id,
            'status' => $result->status instanceof BackedEnum ? $result->status->value : $result->status,
            'allocation_started_at' => $result->allocation_started_at?->toIso8601String(),
        ]);
    }

    public function completeAllocation(
        Request $request,
        string $sessionId,
        CompleteAllocationAction $action,
    ): JsonResponse {
        $session = $this->findSession($sessionId, $request->user()->company_id);
        $this->authorize('allocate', $session);

        $result = $action->execute($session, (string) $request->user()->id);

        return $this->success([
            'id' => $result->id,
            'status' => $result->status instanceof BackedEnum ? $result->status->value : $result->status,
            'allocation_completed_at' => $result->allocation_completed_at?->toIso8601String(),
        ]);
    }

    public function override(
        OverrideAllocationRequest $request,
        string $sessionId,
        string $assignmentId,
        AllocationDecisionChainService $chainService,
    ): JsonResponse {
        $session = $this->findSession($sessionId, $request->user()->company_id);
        $this->authorize('allocate', $session);

        $validated = $request->validated();

        $record = AllocationRecord::where('id', $validated['allocation_record_id'])
            ->where('vehicle_assignment_id', $assignmentId)
            ->first();

        if (! $record) {
            abort(404, "Allocation record [{$validated['allocation_record_id']}] not found.");
        }

        $actorType = $validated['actor_type'];
        $decision = match ($actorType) {
            'dispatcher' => $chainService->recordDispatcherOverride(
                $record,
                (float) $validated['new_quantity'],
                (string) $request->user()->id,
                $validated['reason'],
            ),
            'driver' => $chainService->recordDriverOverride(
                $record,
                (float) $validated['new_quantity'],
                (string) $request->user()->id,
                $validated['reason'],
            ),
            default => abort(422, "Unknown actor_type: {$actorType}"),
        };

        return $this->success([
            'decision_id' => $decision->id,
            'revision_number' => $decision->revision_number,
            'quantity_before' => $decision->quantity_before,
            'quantity_after' => $decision->quantity_after,
            'actor_type' => $decision->actor_type,
            'reason' => $decision->reason,
            'recorded_at' => $decision->recorded_at?->toIso8601String(),
        ]);
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
