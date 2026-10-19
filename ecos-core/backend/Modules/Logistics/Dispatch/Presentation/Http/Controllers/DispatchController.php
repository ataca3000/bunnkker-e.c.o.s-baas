<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Modules\Logistics\Dispatch\Domain\Enums\AssignmentStatus;
use Modules\Logistics\Dispatch\Domain\Enums\DispatchBoardStatus;
use Modules\Logistics\Dispatch\Domain\Enums\ProposalStatus;
use Modules\Logistics\Dispatch\Domain\Exceptions\DispatchException;
use Modules\Logistics\Dispatch\Domain\Models\DispatchBoard;
use Modules\Logistics\Dispatch\Domain\Models\DispatchPolicy;
use Modules\Logistics\Dispatch\Domain\Models\DispatchProposal;
use Modules\Logistics\Dispatch\Domain\Models\DispatchProposedAssignment;
use Modules\Logistics\Dispatch\Domain\Services\DispatchProposalService;
use Modules\Logistics\Dispatch\Domain\Services\DispatchReleaseService;
use Modules\Logistics\Dispatch\Domain\Services\ResourcePoolService;
use Modules\Logistics\Dispatch\Presentation\Http\Resources\DispatchBoardResource;
use Modules\Logistics\Dispatch\Presentation\Http\Resources\DispatchProposalResource;

/**
 * Dispatch boards, proposals and the release into V1.
 *
 * Every blocked row carries its ordered reasons, so a dispatcher never sees a
 * refusal without knowing why (the LOG-005 retryBlockers() contract).
 */
class DispatchController extends Controller
{
    public function __construct(
        private readonly DispatchProposalService $proposals,
        private readonly DispatchReleaseService $releases,
        private readonly ResourcePoolService $pool,
    ) {}

    public function options(): JsonResponse
    {
        return response()->json([
            'board_statuses' => DispatchBoardStatus::options(),
            'proposal_statuses' => ProposalStatus::options(),
            'assignment_statuses' => AssignmentStatus::options(),
        ]);
    }

    // ── Boards ───────────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $query = DispatchBoard::query()
            ->when($this->companyId($request), fn ($q, $id) => $q->where('company_id', $id))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('date'), fn ($q) => $q->where('board_date', $request->string('date')))
            ->with('region')
            ->latest('board_date');

        return DispatchBoardResource::collection(
            $query->paginate(max(1, min((int) $request->integer('per_page', 20), 100)))
        )->response();
    }

    public function show(string $id): DispatchBoardResource
    {
        return new DispatchBoardResource(
            $this->board($id)->load(['region', 'proposals.assignments.blockers'])
        );
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'board_date' => ['required', 'date'],
            'dispatch_region_id' => ['nullable', 'integer', 'exists:network_dispatch_regions,id'],
            'warehouse_id' => ['nullable', 'string', 'max:36'],
        ]);

        $validated['company_id'] = $this->companyId($request);
        $validated['created_by'] = $request->user()?->id;

        try {
            $board = $this->proposals->openBoard(
                array_filter($validated, static fn ($v) => $v !== null),
                $request->user()?->name,
            );
        } catch (DispatchException $e) {
            return $this->unprocessable($e);
        }

        return (new DispatchBoardResource($board))->response()->setStatusCode(201);
    }

    public function setStatus(Request $request, string $id): JsonResponse|DispatchBoardResource
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(DispatchBoardStatus::values())],
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        try {
            $board = $this->proposals->changeBoardStatus(
                $this->board($id),
                DispatchBoardStatus::from($validated['status']),
                $validated['reason'] ?? null,
            );
        } catch (DispatchException $e) {
            return $this->unprocessable($e);
        }

        return new DispatchBoardResource($board);
    }

    /** Fit vehicles × available drivers, with the verdict that decided each. */
    public function resourcePool(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->pool->build($this->companyId($request)),
        ]);
    }

    // ── Proposals ────────────────────────────────────────────────────────────

    public function propose(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'policy_id' => ['nullable', 'string', 'max:36'],
        ]);

        $policy = isset($validated['policy_id'])
            ? DispatchPolicy::where('uuid', $validated['policy_id'])->first()
            : null;

        try {
            $proposal = $this->proposals->generate(
                $this->board($id),
                $policy,
                $request->user()?->id,
                $request->user()?->name,
            );
        } catch (DispatchException $e) {
            return $this->unprocessable($e);
        }

        return (new DispatchProposalResource($proposal->load('assignments.blockers')))
            ->response()
            ->setStatusCode(201);
    }

    public function acceptProposal(Request $request, string $id): JsonResponse|DispatchProposalResource
    {
        try {
            $proposal = $this->proposals->accept(
                $this->proposal($id),
                $request->user()?->id,
                $request->user()?->name,
            );
        } catch (DispatchException $e) {
            return $this->unprocessable($e);
        }

        return new DispatchProposalResource($proposal->load('assignments.blockers'));
    }

    public function rejectProposal(Request $request, string $id): JsonResponse|DispatchProposalResource
    {
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        try {
            $proposal = $this->proposals->reject(
                $this->proposal($id),
                $validated['reason'] ?? null,
                $request->user()?->id,
                $request->user()?->name,
            );
        } catch (DispatchException $e) {
            return $this->unprocessable($e);
        }

        return new DispatchProposalResource($proposal);
    }

    public function overrideAssignment(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
            'vehicle_id' => ['nullable', 'integer', 'exists:logistics_vehicles,id'],
            'driver_id' => ['nullable', 'integer', 'exists:logistics_drivers,id'],
        ]);

        try {
            $assignment = $this->proposals->override(
                $this->assignment($id),
                $validated['reason'],
                $validated['vehicle_id'] ?? null,
                $validated['driver_id'] ?? null,
            );
        } catch (DispatchException $e) {
            return $this->unprocessable($e);
        }

        return response()->json([
            'data' => [
                'id' => $assignment->uuid,
                'status' => $assignment->status->value,
                'blockers' => $assignment->blockerReasons(),
            ],
        ]);
    }

    // ── Release — the V1 boundary ────────────────────────────────────────────

    /**
     * Commit the accepted proposal's assignments through V1's own services.
     *
     * PARTIAL SUCCESS IS A NORMAL 200, not an error: on any real morning a few
     * trips are blocked while the rest must go out. The response echoes the ids
     * V1 returned as proof the boundary was crossed correctly.
     */
    public function release(Request $request, string $id): JsonResponse
    {
        try {
            $result = $this->releases->release(
                $this->proposal($id),
                $request->user()?->id,
                $request->user()?->name,
            );
        } catch (DispatchException $e) {
            return $this->unprocessable($e);
        }

        return response()->json($result);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function board(string $id): DispatchBoard
    {
        return DispatchBoard::where('uuid', $id)->firstOrFail();
    }

    private function proposal(string $id): DispatchProposal
    {
        return DispatchProposal::where('uuid', $id)->firstOrFail();
    }

    private function assignment(string $id): DispatchProposedAssignment
    {
        return DispatchProposedAssignment::where('uuid', $id)->firstOrFail();
    }

    private function unprocessable(DispatchException $e): JsonResponse
    {
        return response()->json(['message' => $e->getMessage()], 422);
    }

    private function companyId(Request $request): ?string
    {
        $companyId = $request->user()?->company_id;

        return $companyId === null ? null : (string) $companyId;
    }
}
