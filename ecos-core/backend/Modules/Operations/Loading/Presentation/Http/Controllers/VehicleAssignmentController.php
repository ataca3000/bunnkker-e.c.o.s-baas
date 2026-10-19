<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use BackedEnum;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Operations\Loading\Application\Actions\AssignVehicleToSessionAction;
use Modules\Operations\Loading\Application\Actions\DispatchVehicleAction;
use Modules\Operations\Loading\Application\Actions\LoadProductAction;
use Modules\Operations\Loading\Domain\Exceptions\LoadingSessionNotFoundException;
use Modules\Operations\Loading\Domain\Models\LoadingSession;
use Modules\Operations\Loading\Domain\Models\VehicleAssignment;
use Modules\Operations\Loading\Presentation\Http\Requests\AssignVehicleRequest;
use Modules\Operations\Loading\Presentation\Http\Requests\DispatchVehicleRequest;
use Modules\Operations\Loading\Presentation\Http\Requests\LoadProductRequest;
use Modules\Operations\Loading\Presentation\Http\Resources\VehicleAssignmentResource;

final class VehicleAssignmentController extends Controller
{
    use HasApiResponse;

    public function index(Request $request, string $sessionId): JsonResponse
    {
        $session = $this->findSession($sessionId, $request->user()->company_id);
        $this->authorize('view', $session);

        $assignments = VehicleAssignment::where('loading_session_id', $session->id)
            ->orderByDesc('created_at')
            ->get();

        return $this->success(VehicleAssignmentResource::collection($assignments));
    }

    public function store(
        AssignVehicleRequest $request,
        string $sessionId,
        AssignVehicleToSessionAction $action,
    ): JsonResponse {
        $session = $this->findSession($sessionId, $request->user()->company_id);
        $this->authorize('create', VehicleAssignment::class);

        $validated = $request->validated();
        $assignment = $action->execute(
            session: $session,
            vehicleId: $validated['vehicle_id'],
            vehicleRegistration: $validated['vehicle_registration'],
            vehicleType: $validated['vehicle_type'],
            capacityWeightKg: (float) $validated['capacity_weight_kg'],
            capacityVolumeM3: (float) $validated['capacity_volume_m3'],
            refrigerated: (bool) ($validated['refrigerated'] ?? false),
            actorId: (string) $request->user()->id,
            vehiclePlanSlotId: $validated['vehicle_plan_slot_id'] ?? null,
            notes: $validated['notes'] ?? null,
        );

        return $this->created(new VehicleAssignmentResource($assignment));
    }

    public function show(Request $request, string $sessionId, string $assignmentId): JsonResponse
    {
        $session = $this->findSession($sessionId, $request->user()->company_id);
        $this->authorize('view', $session);

        $assignment = VehicleAssignment::where('id', $assignmentId)
            ->where('loading_session_id', $session->id)
            ->with(['loadingTasks', 'driverAssignment'])
            ->first();

        if (! $assignment) {
            abort(404, "Vehicle assignment [{$assignmentId}] not found.");
        }

        return $this->success(new VehicleAssignmentResource($assignment));
    }

    public function loadProduct(
        LoadProductRequest $request,
        string $sessionId,
        string $assignmentId,
        LoadProductAction $action,
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
        $task = $action->execute(
            assignment: $assignment,
            poolEntryId: $validated['pool_entry_id'],
            productId: $validated['product_id'],
            skuSnapshot: $validated['sku_snapshot'],
            nameSnapshot: $validated['name_snapshot'],
            preparationWaveId: $validated['preparation_wave_id'],
            quantityPlanned: (float) $validated['quantity_planned'],
            quantityLoaded: (float) $validated['quantity_loaded'],
            loadedBy: (string) $request->user()->id,
            requiresRefrigeration: (bool) ($validated['requires_refrigeration'] ?? false),
            shortReason: $validated['short_reason'] ?? null,
            notes: $validated['notes'] ?? null,
        );

        return $this->created([
            'id' => $task->id,
            'status' => $task->status instanceof BackedEnum ? $task->status->value : $task->status,
            'product_id' => $task->product_id,
            'sku_snapshot' => $task->sku_snapshot,
            'quantity_planned' => $task->quantity_planned,
            'quantity_loaded' => $task->quantity_loaded,
            'quantity_short' => $task->quantity_short,
            'loaded_at' => $task->loaded_at?->toIso8601String(),
        ]);
    }

    public function dispatch(
        DispatchVehicleRequest $request,
        string $sessionId,
        string $assignmentId,
        DispatchVehicleAction $action,
    ): JsonResponse {
        $session = $this->findSession($sessionId, $request->user()->company_id);
        $this->authorize('dispatch', $session);

        $assignment = VehicleAssignment::where('id', $assignmentId)
            ->where('loading_session_id', $session->id)
            ->first();

        if (! $assignment) {
            abort(404, "Vehicle assignment [{$assignmentId}] not found.");
        }

        $result = $action->execute($assignment, (string) $request->user()->id);

        return $this->success(new VehicleAssignmentResource($result));
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
