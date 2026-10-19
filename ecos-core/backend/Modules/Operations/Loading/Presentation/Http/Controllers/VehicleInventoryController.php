<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Operations\Loading\Domain\Exceptions\LoadingSessionNotFoundException;
use Modules\Operations\Loading\Domain\Models\LoadingSession;
use Modules\Operations\Loading\Domain\Models\VehicleAssignment;
use Modules\Operations\Loading\Domain\Models\VehicleInventoryItem;
use Modules\Operations\Loading\Presentation\Http\Resources\VehicleInventoryItemResource;

final class VehicleInventoryController extends Controller
{
    use HasApiResponse;

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

        $items = VehicleInventoryItem::where('vehicle_assignment_id', $assignment->id)
            ->orderBy('sku_snapshot')
            ->get();

        $summary = [
            'vehicle_assignment_id' => $assignment->id,
            'assignment_number' => $assignment->assignment_number,
            'total_quantity_loaded' => (float) $items->sum('quantity_loaded'),
            'total_quantity_delivered' => (float) $items->sum('quantity_delivered'),
            'total_quantity_returned' => (float) $items->sum('quantity_returned'),
            'total_quantity_on_hand' => (float) $items->sum('quantity_on_hand'),
            'products_count' => $items->count(),
        ];

        return $this->success([
            'summary' => $summary,
            'items' => VehicleInventoryItemResource::collection($items),
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
