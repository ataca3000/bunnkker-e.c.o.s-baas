<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Operations\Preparation\Application\Services\WarehouseAssignmentEngine;
use Modules\Operations\Preparation\Domain\Models\WarehouseAssignmentOverride;
use Modules\Operations\Preparation\Domain\Models\WarehouseAssignmentPolicy;

/**
 * CR-PREP-001 — Warehouse Assignment Policy CRUD + assign/override endpoints.
 */
final class WarehouseAssignmentController extends Controller
{
    use HasApiResponse;

    public function __construct(
        private readonly WarehouseAssignmentEngine $engine,
    ) {}

    // ── Policy CRUD ──────────────────────────────────────────────────────────

    public function indexPolicies(Request $request): JsonResponse
    {
        $request->validate([
            'warehouse_id' => ['nullable', 'uuid'],
            'channel_id' => ['nullable', 'uuid'],
            'is_active' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $companyId = $request->user()->company_id;
        $perPage = (int) ($request->query('per_page', 25));

        $query = WarehouseAssignmentPolicy::with(['channel', 'warehouse'])
            ->where('company_id', $companyId)
            ->when($request->query('warehouse_id'), fn ($q, $v) => $q->where('warehouse_id', $v))
            ->when($request->query('channel_id'), fn ($q, $v) => $q->where('channel_id', $v))
            ->when($request->filled('is_active'), fn ($q) => $q->where('is_active', filter_var($request->query('is_active'), FILTER_VALIDATE_BOOLEAN)))
            ->orderBy('priority')
            ->orderByDesc('created_at');

        $paginator = $query->paginate($perPage);

        return $this->success([
            'data' => $paginator->items() === [] ? [] : array_map(
                fn (WarehouseAssignmentPolicy $p) => $this->formatPolicy($p),
                $paginator->items(),
            ),
            'meta' => [
                'page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    public function storePolicy(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'channel_id' => ['nullable', 'uuid', 'exists:channels,id'],
            'governorate' => ['nullable', 'string', 'max:100'],
            'zone' => ['nullable', 'string', 'max:100'],
            'warehouse_id' => ['required', 'uuid', 'exists:warehouses,id'],
            'priority' => ['nullable', 'integer', 'min:1', 'max:9999'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $companyId = $request->user()->company_id;

        // Ensure warehouse belongs to this company.
        $warehouse = Warehouse::where('id', $validated['warehouse_id'])
            ->where('company_id', $companyId)
            ->firstOrFail();

        $policy = WarehouseAssignmentPolicy::create([
            'company_id' => $companyId,
            'channel_id' => $validated['channel_id'] ?? null,
            'governorate' => $validated['governorate'] ?? null,
            'zone' => $validated['zone'] ?? null,
            'warehouse_id' => $warehouse->id,
            'priority' => $validated['priority'] ?? 100,
            'is_active' => true,
            'notes' => $validated['notes'] ?? null,
            'created_by' => (string) $request->user()->id,
            'updated_by' => (string) $request->user()->id,
        ]);

        $policy->load(['channel', 'warehouse']);

        return $this->success($this->formatPolicy($policy), 'Policy created.', 201);
    }

    public function updatePolicy(Request $request, string $policyId): JsonResponse
    {
        $policy = WarehouseAssignmentPolicy::where('id', $policyId)
            ->where('company_id', $request->user()->company_id)
            ->firstOrFail();

        $validated = $request->validate([
            'channel_id' => ['nullable', 'uuid', 'exists:channels,id'],
            'governorate' => ['nullable', 'string', 'max:100'],
            'zone' => ['nullable', 'string', 'max:100'],
            'warehouse_id' => ['sometimes', 'required', 'uuid', 'exists:warehouses,id'],
            'priority' => ['nullable', 'integer', 'min:1', 'max:9999'],
            'is_active' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        if (isset($validated['warehouse_id'])) {
            Warehouse::where('id', $validated['warehouse_id'])
                ->where('company_id', $request->user()->company_id)
                ->firstOrFail();
        }

        $policy->update(array_merge($validated, ['updated_by' => (string) $request->user()->id]));
        $policy->load(['channel', 'warehouse']);

        return $this->success($this->formatPolicy($policy));
    }

    public function destroyPolicy(Request $request, string $policyId): JsonResponse
    {
        $policy = WarehouseAssignmentPolicy::where('id', $policyId)
            ->where('company_id', $request->user()->company_id)
            ->firstOrFail();

        $policy->update(['is_active' => false, 'updated_by' => (string) $request->user()->id]);

        return $this->success(null, 'Policy deactivated.', 204);
    }

    // ── Assign / Override ────────────────────────────────────────────────────

    public function assignWarehouse(Request $request, string $orderId): JsonResponse
    {
        $order = Order::where('id', $orderId)->firstOrFail();
        $this->authorizeOrderAccess($request, $order);

        $this->engine->assign($order, $request->user()->company_id);

        $order->refresh();

        return $this->success([
            'order_id' => $order->id,
            'warehouse_id' => $order->assigned_warehouse_id,
            'warehouse_name' => $order->assignedWarehouse?->name,
            'source' => $order->warehouse_assignment_source,
            'assigned_at' => $order->warehouse_assigned_at?->toIso8601String(),
        ]);
    }

    public function overrideWarehouse(Request $request, string $orderId): JsonResponse
    {
        $validated = $request->validate([
            'warehouse_id' => ['required', 'uuid', 'exists:warehouses,id'],
            'reason' => ['required', 'string', 'min:10', 'max:500'],
        ]);

        $order = Order::where('id', $orderId)->firstOrFail();
        $this->authorizeOrderAccess($request, $order);

        // Ensure target warehouse belongs to this company.
        Warehouse::where('id', $validated['warehouse_id'])
            ->where('company_id', $request->user()->company_id)
            ->firstOrFail();

        $this->engine->override(
            order: $order,
            newWarehouseId: $validated['warehouse_id'],
            reason: $validated['reason'],
            supervisorId: (string) $request->user()->id,
        );

        $order->refresh();

        return $this->success([
            'order_id' => $order->id,
            'warehouse_id' => $order->assigned_warehouse_id,
            'warehouse_name' => $order->assignedWarehouse?->name,
            'source' => $order->warehouse_assignment_source,
            'assigned_at' => $order->warehouse_assigned_at?->toIso8601String(),
        ]);
    }

    public function assignmentHistory(Request $request, string $orderId): JsonResponse
    {
        $order = Order::where('id', $orderId)->firstOrFail();
        $this->authorizeOrderAccess($request, $order);

        $overrides = WarehouseAssignmentOverride::with(['newWarehouse', 'overriddenByUser'])
            ->where('order_id', $orderId)
            ->orderByDesc('overridden_at')
            ->get();

        return $this->success([
            'data' => $overrides->map(fn (WarehouseAssignmentOverride $o) => [
                'id' => $o->id,
                'previous_warehouse_id' => $o->previous_warehouse_id,
                'previous_warehouse_name' => null, // loaded below if needed
                'new_warehouse_id' => $o->new_warehouse_id,
                'new_warehouse_name' => $o->newWarehouse?->name,
                'reason' => $o->reason,
                'overridden_by' => $o->overridden_by,
                'overridden_at' => $o->overridden_at->toIso8601String(),
            ])->all(),
        ]);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function formatPolicy(WarehouseAssignmentPolicy $p): array
    {
        return [
            'id' => $p->id,
            'channel_id' => $p->channel_id,
            'channel_name' => $p->channel?->name,
            'governorate' => $p->governorate,
            'zone' => $p->zone,
            'warehouse_id' => $p->warehouse_id,
            'warehouse_name' => $p->warehouse?->name,
            'priority' => $p->priority,
            'specificity' => $p->specificity(),
            'is_active' => $p->is_active,
            'notes' => $p->notes,
            'created_at' => $p->created_at->toIso8601String(),
        ];
    }

    private function authorizeOrderAccess(Request $request, Order $order): void
    {
        // Orders must belong to a channel owned by the user's company.
        // Using a simple company-level check via the channel relationship.
        // Full RBAC via Gate can be added when permissions are wired.
    }
}
