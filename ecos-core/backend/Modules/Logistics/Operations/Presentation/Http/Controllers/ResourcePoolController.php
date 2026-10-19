<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Modules\Logistics\Operations\Domain\Enums\PoolMemberStatus;
use Modules\Logistics\Operations\Domain\Enums\PoolMemberType;
use Modules\Logistics\Operations\Domain\Enums\PoolStatus;
use Modules\Logistics\Operations\Domain\Enums\PoolType;
use Modules\Logistics\Operations\Domain\Models\ResourcePool;
use Modules\Logistics\Operations\Domain\Models\ResourcePoolMember;
use Modules\Logistics\Operations\Domain\Services\AvailabilityMatrixService;
use Modules\Logistics\Operations\Domain\Services\PoolHealthService;
use Modules\Logistics\Operations\Domain\Services\ResourcePoolManagementService;
use Modules\Logistics\Operations\Domain\Services\UnifiedResourcePoolService;
use Modules\Logistics\Operations\Presentation\Http\Resources\ResourcePoolResource;

/**
 * Pools, membership, the unified view and the availability matrix.
 *
 * Readiness never appears on a write endpoint. Membership is what this
 * controller changes; whether a member can work is fetched from Fleet and
 * Drivers on the read path and is not something a pool can be told.
 */
class ResourcePoolController extends Controller
{
    public function __construct(
        private readonly ResourcePoolManagementService $pools,
        private readonly UnifiedResourcePoolService $unified,
        private readonly PoolHealthService $health,
        private readonly AvailabilityMatrixService $matrix,
    ) {}

    public function options(): JsonResponse
    {
        return response()->json([
            'pool_types' => PoolType::options(),
            'pool_statuses' => PoolStatus::options(),
            'member_types' => PoolMemberType::options(),
            'member_statuses' => PoolMemberStatus::options(),
        ]);
    }

    // ── Pools ────────────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $query = ResourcePool::query()
            ->when($this->companyId($request), fn ($q, $id) => $q->where('company_id', $id))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('pool_type'), fn ($q) => $q->where('pool_type', $request->string('pool_type')))
            ->with(['region', 'serviceArea'])
            ->withCount(['members', 'activeMembers'])
            ->orderBy('name');

        return ResourcePoolResource::collection(
            $query->paginate(max(1, min((int) $request->integer('per_page', 20), 100)))
        )->response();
    }

    public function show(string $id): ResourcePoolResource
    {
        return new ResourcePoolResource(
            $this->pool($id)->load(['region', 'serviceArea'])->loadCount(['members', 'activeMembers'])
        );
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:40'],
            'name' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string'],
            'pool_type' => ['required', Rule::in(PoolType::values())],
            'dispatch_region_id' => ['nullable', 'integer', 'exists:network_dispatch_regions,id'],
            'service_area_id' => ['nullable', 'integer', 'exists:network_service_areas,id'],
            'min_assignable' => ['nullable', 'integer', 'min:0', 'max:9999'],
        ]);

        $validated['company_id'] = $this->companyId($request);

        $pool = $this->pools->create($validated, $request->user()?->id);

        return (new ResourcePoolResource($pool->load(['region', 'serviceArea'])))
            ->response()
            ->setStatusCode(201);
    }

    public function setStatus(Request $request, string $id): ResourcePoolResource
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(PoolStatus::values())],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $pool = $this->pools->setStatus(
            $this->pool($id),
            PoolStatus::from($validated['status']),
            $validated['reason'] ?? null,
        );

        return new ResourcePoolResource($pool->load(['region', 'serviceArea']));
    }

    // ── Membership ───────────────────────────────────────────────────────────

    public function addMember(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'member_type' => ['required', Rule::in(PoolMemberType::values())],
            'member_id' => ['required', 'integer', 'min:1'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $member = $this->pools->addMember(
            $this->pool($id),
            PoolMemberType::from($validated['member_type']),
            (int) $validated['member_id'],
            $validated['reason'] ?? null,
            $request->user()?->id,
        );

        return response()->json(['data' => $this->memberPayload($member)], 201);
    }

    public function setMemberStatus(Request $request, string $memberId): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(PoolMemberStatus::values())],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $member = $this->member($memberId);
        $target = PoolMemberStatus::from($validated['status']);
        $reason = $validated['reason'] ?? null;

        $member = match ($target) {
            PoolMemberStatus::Suspended => $this->pools->suspendMember($member, $reason),
            PoolMemberStatus::Active => $this->pools->reinstateMember($member, $reason),
            // Withdrawal demands a reason, so it is routed through its own
            // method rather than sharing this one's optional field.
            PoolMemberStatus::Withdrawn => $this->pools->withdrawMember($member, (string) $reason),
        };

        return response()->json(['data' => $this->memberPayload($member)]);
    }

    // ── Views ────────────────────────────────────────────────────────────────

    /** Membership joined to the owning modules' current verdicts. */
    public function unifiedView(string $id): JsonResponse
    {
        return response()->json(['data' => $this->unified->forPool($this->pool($id))]);
    }

    /** Resources in no pool at all — capacity nobody is planning with. */
    public function unassigned(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->unified->unassigned($this->companyId($request))]);
    }

    public function poolHealth(string $id): JsonResponse
    {
        return response()->json(['data' => $this->health->forPool($this->pool($id))]);
    }

    public function healthOverview(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->health->overview($this->companyId($request))]);
    }

    public function availabilityMatrix(Request $request): JsonResponse
    {
        $request->validate([
            'from' => ['nullable', 'date'],
            'days' => ['nullable', 'integer', 'min:1', 'max:14'],
        ]);

        return response()->json([
            'data' => $this->matrix->build(
                $this->companyId($request),
                $request->filled('from') ? Carbon::parse($request->string('from')) : null,
                (int) $request->integer('days', 7),
            ),
        ]);
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private function pool(string $id): ResourcePool
    {
        return ResourcePool::query()->where('uuid', $id)->firstOrFail();
    }

    private function member(string $id): ResourcePoolMember
    {
        return ResourcePoolMember::query()->where('uuid', $id)->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function memberPayload(ResourcePoolMember $member): array
    {
        return [
            'id' => $member->uuid,
            'member_type' => $member->member_type->value,
            'member_id' => $member->member_id,
            'status' => $member->status->value,
            'status_label' => $member->status->label(),
            'status_tone' => $member->status->tone(),
            'status_reason' => $member->status_reason,
            'membership_reason' => $member->membership_reason,
            'readiness_authority' => $member->readinessAuthority(),
            'joined_at' => $member->joined_at?->toIso8601String(),
            'left_at' => $member->left_at?->toIso8601String(),
        ];
    }

    private function companyId(Request $request): ?string
    {
        $companyId = $request->user()?->company_id;

        return $companyId === null ? null : (string) $companyId;
    }
}
