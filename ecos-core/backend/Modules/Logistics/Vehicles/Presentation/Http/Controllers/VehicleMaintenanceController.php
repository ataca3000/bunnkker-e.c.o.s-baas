<?php

declare(strict_types=1);

namespace Modules\Logistics\Vehicles\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Modules\Logistics\Vehicles\Domain\Contracts\VehicleRepositoryInterface;
use Modules\Logistics\Vehicles\Domain\Enums\MaintenanceType;
use Modules\Logistics\Vehicles\Domain\Exceptions\VehicleException;
use Modules\Logistics\Vehicles\Domain\Services\VehicleMaintenanceService;
use Modules\Logistics\Vehicles\Presentation\Http\Resources\VehicleMaintenanceRecordResource;

/**
 * Maintenance ledger endpoints.
 *
 * BR-8 — creation is open to any authenticated operator; amendment and deletion
 * require the logistics / vehicle_maintenance / manage permission.
 */
class VehicleMaintenanceController extends Controller
{
    public function __construct(
        private readonly VehicleRepositoryInterface $vehicles,
        private readonly VehicleMaintenanceService $maintenance,
    ) {}

    public function index(int $vehicleId): AnonymousResourceCollection
    {
        $vehicle = $this->vehicles->findByIdOrFail($vehicleId);

        return VehicleMaintenanceRecordResource::collection(
            $vehicle->maintenanceRecords()->get()
        );
    }

    public function store(Request $request, int $vehicleId): JsonResponse
    {
        $vehicle = $this->vehicles->findByIdOrFail($vehicleId);

        $validated = $request->validate($this->rules());

        $record = $this->maintenance->record($vehicle, $validated, $this->actor($request));

        return (new VehicleMaintenanceRecordResource($record))
            ->response()
            ->setStatusCode(201);
    }

    public function update(Request $request, int $vehicleId, int $recordId): JsonResponse|VehicleMaintenanceRecordResource
    {
        $vehicle = $this->vehicles->findByIdOrFail($vehicleId);
        $record = $vehicle->maintenanceRecords()->findOrFail($recordId);

        $validated = $request->validate($this->rules(partial: true));

        try {
            $updated = $this->maintenance->amend(
                $record,
                $validated,
                $request->user(),
                $this->actor($request),
            );
        } catch (VehicleException $e) {
            return response()->json(['message' => $e->getMessage()], 403);
        }

        return new VehicleMaintenanceRecordResource($updated);
    }

    public function destroy(Request $request, int $vehicleId, int $recordId): JsonResponse
    {
        $vehicle = $this->vehicles->findByIdOrFail($vehicleId);
        $record = $vehicle->maintenanceRecords()->findOrFail($recordId);

        try {
            $this->maintenance->delete($record, $request->user());
        } catch (VehicleException $e) {
            return response()->json(['message' => $e->getMessage()], 403);
        }

        return response()->json(null, 204);
    }

    /** Tells the UI whether to render amend/delete controls at all. */
    public function permissions(Request $request): JsonResponse
    {
        return response()->json([
            'can_manage_maintenance' => $this->maintenance->canManage($request->user()),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function rules(bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return [
            'performed_on' => [$required, 'date', 'before_or_equal:today'],
            'type' => [$required, Rule::in(MaintenanceType::values())],
            'description' => ['nullable', 'string', 'max:2000'],
            'cost' => ['nullable', 'numeric', 'min:0', 'max:99999999'],
            'currency' => ['nullable', 'string', 'size:3'],
            'vendor' => ['nullable', 'string', 'max:150'],
            'next_maintenance_date' => ['nullable', 'date', 'after_or_equal:performed_on'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    private function actor(Request $request): ?string
    {
        $user = $request->user();

        return $user?->name ?? $user?->email;
    }
}
