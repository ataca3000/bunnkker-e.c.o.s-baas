<?php

declare(strict_types=1);

namespace Modules\Logistics\Network\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Modules\Logistics\Network\Domain\Enums\CapacityCommitmentStatus;
use Modules\Logistics\Network\Domain\Enums\CapacityUnit;
use Modules\Logistics\Network\Domain\Enums\CoverageMemberType;
use Modules\Logistics\Network\Domain\Enums\ServiceAreaStatus;
use Modules\Logistics\Network\Domain\Exceptions\NetworkException;
use Modules\Logistics\Network\Domain\Models\CapacityCommitment;
use Modules\Logistics\Network\Domain\Models\CapacityPlan;
use Modules\Logistics\Network\Domain\Models\CapacitySlot;
use Modules\Logistics\Network\Domain\Models\DispatchRegion;
use Modules\Logistics\Network\Domain\Models\ServiceArea;
use Modules\Logistics\Network\Domain\Models\ServiceLevel;
use Modules\Logistics\Network\Domain\Services\CapacityLedgerService;
use Modules\Logistics\Network\Domain\Services\CoverageResolverService;
use Modules\Logistics\Network\Domain\Services\ServiceAreaService;
use Modules\Logistics\Network\Presentation\Http\Resources\ServiceAreaResource;

/**
 * Network — service areas, coverage, dispatch regions and capacity.
 *
 * The capacity endpoints are ADVISORY: they answer with what remains and what
 * is short. Orders decides. Nothing here rejects an order.
 */
class NetworkController extends Controller
{
    public function __construct(
        private readonly ServiceAreaService $areas,
        private readonly CoverageResolverService $coverage,
        private readonly CapacityLedgerService $capacity,
    ) {}

    public function options(): JsonResponse
    {
        return response()->json([
            'service_area_statuses' => ServiceAreaStatus::options(),
            'member_types' => CoverageMemberType::options(),
            'capacity_units' => CapacityUnit::options(),
            'commitment_statuses' => CapacityCommitmentStatus::options(),
        ]);
    }

    // ── Service areas ────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $query = ServiceArea::query()
            ->when($this->companyId($request), fn ($q, $id) => $q->where('company_id', $id))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when(
                $request->filled('dispatch_region_id'),
                fn ($q) => $q->where('dispatch_region_id', $request->integer('dispatch_region_id')),
            )
            ->with(['region', 'members'])
            ->withCount('members')
            ->orderByDesc('priority')
            ->latest('id');

        return ServiceAreaResource::collection(
            $query->paginate(max(1, min((int) $request->integer('per_page', 20), 100)))
        )->response();
    }

    public function show(string $id): ServiceAreaResource
    {
        return new ServiceAreaResource($this->area($id)->load(['region', 'members', 'coverageRules.level']));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:40'],
            'name' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:2000'],
            'dispatch_region_id' => ['nullable', 'integer', 'exists:network_dispatch_regions,id'],
            'default_lead_time_hours' => ['nullable', 'integer', 'min:0', 'max:720'],
            'priority' => ['nullable', 'integer', 'min:0', 'max:1000'],
            'color' => ['nullable', 'string', 'max:20'],
        ]);

        $validated['company_id'] = $this->companyId($request);
        $validated['created_by'] = $request->user()?->id;

        $area = $this->areas->create(array_filter($validated, static fn ($v) => $v !== null));

        return (new ServiceAreaResource($area))->response()->setStatusCode(201);
    }

    public function setStatus(Request $request, string $id): JsonResponse|ServiceAreaResource
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(ServiceAreaStatus::values())],
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        try {
            $area = $this->areas->changeStatus(
                $this->area($id),
                ServiceAreaStatus::from($validated['status']),
                $validated['reason'] ?? null,
                $request->user()?->name,
            );
        } catch (NetworkException $e) {
            return $this->unprocessable($e);
        }

        return new ServiceAreaResource($area->load('members'));
    }

    // ── Coverage members ─────────────────────────────────────────────────────

    /** Attaches EXISTING geography. Nothing is created here (Directive 8). */
    public function attachMember(Request $request, string $id): JsonResponse|ServiceAreaResource
    {
        $validated = $request->validate([
            'member_type' => ['required', Rule::in(CoverageMemberType::values())],
            'member_id' => ['required', 'string', 'max:36'],
            'is_excluded' => ['nullable', 'boolean'],
        ]);

        try {
            $this->coverage->attach(
                $this->area($id),
                CoverageMemberType::from($validated['member_type']),
                $validated['member_id'],
                (bool) ($validated['is_excluded'] ?? false),
                $request->user()?->id,
            );
        } catch (NetworkException $e) {
            return $this->unprocessable($e);
        }

        return new ServiceAreaResource($this->area($id)->load('members'));
    }

    public function detachMember(string $id, int $memberId): ServiceAreaResource
    {
        $area = $this->area($id);
        $this->coverage->detach($area, $memberId);

        return new ServiceAreaResource($area->refresh()->load('members'));
    }

    /**
     * Address → coverage. A no-coverage result is a NORMAL answer, not an error
     * — Network advises, Orders decides.
     */
    public function resolveCoverage(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'city_id' => ['required', 'string', 'max:36'],
        ]);

        return response()->json([
            'data' => $this->coverage->coverageFor(
                $validated['city_id'],
                $this->companyId($request),
            ),
        ]);
    }

    // ── Capacity ─────────────────────────────────────────────────────────────

    /** ADVISORY. Never rejects — it reports remaining and shortfall. */
    public function availability(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'slot_id' => ['required', 'string', 'max:36'],
            'orders' => ['nullable', 'numeric', 'min:0'],
            'stops' => ['nullable', 'numeric', 'min:0'],
            'weight_kg' => ['nullable', 'numeric', 'min:0'],
            'volume_m3' => ['nullable', 'numeric', 'min:0'],
        ]);

        $slot = CapacitySlot::where('uuid', $validated['slot_id'])->firstOrFail();

        return response()->json([
            'data' => $this->capacity->availability($slot, [
                CapacityUnit::Orders->value => (float) ($validated['orders'] ?? 0),
                CapacityUnit::Stops->value => (float) ($validated['stops'] ?? 0),
                CapacityUnit::WeightKg->value => (float) ($validated['weight_kg'] ?? 0),
                CapacityUnit::VolumeM3->value => (float) ($validated['volume_m3'] ?? 0),
            ]),
        ]);
    }

    public function reserve(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'slot_id' => ['required', 'string', 'max:36'],
            'orders' => ['nullable', 'numeric', 'min:0'],
            'stops' => ['nullable', 'numeric', 'min:0'],
            'weight_kg' => ['nullable', 'numeric', 'min:0'],
            'volume_m3' => ['nullable', 'numeric', 'min:0'],
            'reference_type' => ['nullable', 'string', 'max:40'],
            'reference_id' => ['nullable', 'string', 'max:64'],
            'ttl_minutes' => ['nullable', 'integer', 'min:1', 'max:1440'],
        ]);

        $slot = CapacitySlot::where('uuid', $validated['slot_id'])->firstOrFail();

        try {
            $commitment = $this->capacity->reserve(
                $slot,
                [
                    CapacityUnit::Orders->value => (float) ($validated['orders'] ?? 0),
                    CapacityUnit::Stops->value => (float) ($validated['stops'] ?? 0),
                    CapacityUnit::WeightKg->value => (float) ($validated['weight_kg'] ?? 0),
                    CapacityUnit::VolumeM3->value => (float) ($validated['volume_m3'] ?? 0),
                ],
                $validated['reference_type'] ?? null,
                $validated['reference_id'] ?? null,
                $validated['ttl_minutes'] ?? null,
                $request->user()?->id,
            );
        } catch (NetworkException $e) {
            return $this->unprocessable($e);
        }

        return response()->json(['data' => $this->commitmentPayload($commitment)], 201);
    }

    public function commitReservation(Request $request, string $id): JsonResponse
    {
        try {
            $commitment = $this->capacity->commit($this->commitment($id), $request->user()?->name);
        } catch (NetworkException $e) {
            return $this->unprocessable($e);
        }

        return response()->json(['data' => $this->commitmentPayload($commitment)]);
    }

    public function releaseReservation(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        try {
            $commitment = $this->capacity->release(
                $this->commitment($id),
                $validated['reason'] ?? null,
                $request->user()?->name,
            );
        } catch (NetworkException $e) {
            return $this->unprocessable($e);
        }

        return response()->json(['data' => $this->commitmentPayload($commitment)]);
    }

    /** Reclaim expired soft holds so abandoned checkouts stop eating capacity. */
    public function sweepExpired(): JsonResponse
    {
        return response()->json(['reclaimed' => $this->capacity->sweepExpired()]);
    }

    // ── Dispatch regions and service levels ──────────────────────────────────

    public function regions(Request $request): JsonResponse
    {
        $regions = DispatchRegion::query()
            ->when($this->companyId($request), fn ($q, $id) => $q->where('company_id', $id))
            ->withCount('serviceAreas')
            ->get()
            ->map(static fn (DispatchRegion $region) => [
                'id' => $region->uuid,
                'code' => $region->code,
                'name' => $region->name,
                'warehouse_id' => $region->warehouse_id,
                'has_origin' => $region->hasOrigin(),
                'is_active' => $region->is_active,
                'service_area_count' => $region->service_areas_count,
            ]);

        return response()->json(['data' => $regions]);
    }

    public function storeRegion(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:40'],
            'name' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:2000'],
            'warehouse_id' => ['nullable', 'string', 'max:36'],
            'branch_id' => ['nullable', 'string', 'max:36'],
        ]);

        $validated['company_id'] = $this->companyId($request);
        $validated['created_by'] = $request->user()?->id;

        $region = DispatchRegion::create(array_filter($validated, static fn ($v) => $v !== null));

        return response()->json([
            'data' => ['id' => $region->uuid, 'code' => $region->code, 'name' => $region->name],
        ], 201);
    }

    public function serviceLevels(Request $request): JsonResponse
    {
        $levels = ServiceLevel::query()
            ->when($this->companyId($request), fn ($q, $id) => $q->where('company_id', $id))
            ->where('is_active', true)
            ->orderBy('display_order')
            ->get()
            ->map(static fn (ServiceLevel $level) => [
                'id' => $level->uuid,
                'code' => $level->code,
                'name' => $level->name,
                'target_hours' => $level->target_hours,
                'is_same_day' => $level->isSameDay(),
            ]);

        return response()->json(['data' => $levels]);
    }

    public function storeServiceLevel(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:40'],
            'name' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:2000'],
            'target_hours' => ['nullable', 'integer', 'min:1', 'max:8760'],
            'display_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $validated['company_id'] = $this->companyId($request);

        $level = ServiceLevel::create(array_filter($validated, static fn ($v) => $v !== null));

        return response()->json([
            'data' => ['id' => $level->uuid, 'code' => $level->code, 'name' => $level->name],
        ], 201);
    }

    public function capacityPlans(Request $request, string $areaId): JsonResponse
    {
        $plans = $this->area($areaId)->capacityPlans()->with('slots')->limit(60)->get()
            ->map(static fn (CapacityPlan $plan) => [
                'id' => $plan->uuid,
                'plan_date' => $plan->plan_date?->toDateString(),
                'is_published' => $plan->is_published,
                'total_remaining' => $plan->totalRemaining(),
                'slots' => $plan->slots->map(static fn (CapacitySlot $slot) => [
                    'id' => $slot->uuid,
                    'window_start' => $slot->window_start,
                    'window_end' => $slot->window_end,
                    'remaining' => $slot->remaining(),
                    'utilisation' => $slot->utilisation(),
                    'binding_unit' => $slot->bindingUnit()?->value,
                    'at_warn_threshold' => $slot->isAtWarnThreshold(),
                    'is_exhausted' => $slot->isExhausted(),
                ])->values(),
            ]);

        return response()->json(['data' => $plans]);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function area(string $id): ServiceArea
    {
        return ServiceArea::where('uuid', $id)->firstOrFail();
    }

    private function commitment(string $id): CapacityCommitment
    {
        return CapacityCommitment::where('uuid', $id)->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function commitmentPayload(CapacityCommitment $commitment): array
    {
        return [
            'id' => $commitment->uuid,
            'status' => $commitment->status->value,
            'status_label' => $commitment->status->label(),
            'holds_capacity' => $commitment->holdsCapacity(),
            'quantities' => $commitment->quantities(),
            'reference_type' => $commitment->reference_type,
            'reference_id' => $commitment->reference_id,
            'expires_at' => $commitment->expires_at?->toIso8601String(),
            'committed_at' => $commitment->committed_at?->toIso8601String(),
            'released_at' => $commitment->released_at?->toIso8601String(),
            'release_reason' => $commitment->release_reason,
        ];
    }

    private function unprocessable(NetworkException $e): JsonResponse
    {
        return response()->json(['message' => $e->getMessage()], 422);
    }

    private function companyId(Request $request): ?string
    {
        $companyId = $request->user()?->company_id;

        return $companyId === null ? null : (string) $companyId;
    }
}
