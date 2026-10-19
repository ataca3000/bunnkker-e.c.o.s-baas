<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Modules\Logistics\Delivery\Domain\Contracts\DeliveryRepositoryInterface;
use Modules\Logistics\Delivery\Domain\Enums\AttemptStatus;
use Modules\Logistics\Delivery\Domain\Enums\CodStatus;
use Modules\Logistics\Delivery\Domain\Enums\DeliveryReturnStatus;
use Modules\Logistics\Delivery\Domain\Enums\DeliveryStatus;
use Modules\Logistics\Delivery\Domain\Enums\FailureCategory;
use Modules\Logistics\Delivery\Domain\Enums\FailureReason;
use Modules\Logistics\Delivery\Domain\Enums\PodArtifactKind;
use Modules\Logistics\Delivery\Domain\Exceptions\DeliveryException;
use Modules\Logistics\Delivery\Domain\Services\DeliveryExecutionService;
use Modules\Logistics\Delivery\Domain\Services\TrackingProjectionService;
use Modules\Logistics\Delivery\Presentation\Http\Resources\DeliveryResource;
use Modules\Logistics\Delivery\Presentation\Http\Resources\TrackingEventResource;

/**
 * Delivery OS — the aggregate root's read and lifecycle surface.
 *
 * Attempts, POD, returns and COD each have their own controller; this one
 * covers the delivery itself, its timeline and its retry decisions.
 */
class DeliveryController extends Controller
{
    public function __construct(
        private readonly DeliveryRepositoryInterface $deliveries,
        private readonly DeliveryExecutionService $execution,
        private readonly TrackingProjectionService $tracking,
    ) {}

    /** Everything the UI needs to render filters and dropdowns in one call. */
    public function options(): JsonResponse
    {
        return response()->json([
            'delivery_statuses' => DeliveryStatus::options(),
            'attempt_statuses' => AttemptStatus::options(),
            'failure_categories' => FailureCategory::options(),
            'failure_reasons' => FailureReason::catalogue(),
            'pod_artifact_kinds' => PodArtifactKind::options(),
            'return_statuses' => DeliveryReturnStatus::options(),
            'cod_statuses' => CodStatus::options(),
        ]);
    }

    public function stats(Request $request): JsonResponse
    {
        return response()->json(
            $this->deliveries->statistics($this->companyId($request))
        );
    }

    public function index(Request $request): JsonResponse
    {
        $filters = $request->only([
            'status', 'order_id', 'trip_id',
            'failure_category', 'sla_breached', 'awaiting_retry',
        ]);
        $filters['company_id'] = $this->companyId($request);

        $perPage = (int) $request->integer('per_page', 20);
        $page = $this->deliveries->paginate($filters, max(1, min($perPage, 100)));

        return DeliveryResource::collection($page)->response();
    }

    public function show(string $id): DeliveryResource
    {
        return new DeliveryResource($this->deliveries->findByUuidOrFail($id));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'order_id' => ['required', 'string', 'max:64'],
            'current_stop_id' => ['nullable', 'integer'],
            'max_attempts' => ['nullable', 'integer', 'min:1', 'max:10'],
            'retry_cutoff_date' => ['nullable', 'date'],
            'promised_at' => ['nullable', 'date'],
            'sla_grace_minutes' => ['nullable', 'integer', 'min:0', 'max:1440'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $validated['company_id'] = $this->companyId($request);
        $validated['created_by'] = $request->user()?->id;

        $delivery = $this->execution->create($validated, $this->actor($request));

        return (new DeliveryResource($delivery))->response()->setStatusCode(201);
    }

    public function setStatus(Request $request, string $id): JsonResponse|DeliveryResource
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(DeliveryStatus::values())],
        ]);

        $delivery = $this->deliveries->findByUuidOrFail($id);

        try {
            $updated = $this->execution->changeStatus(
                $delivery,
                DeliveryStatus::from($validated['status']),
                $this->actor($request),
            );
        } catch (DeliveryException $e) {
            return $this->unprocessable($e);
        }

        return new DeliveryResource($updated->refresh());
    }

    /**
     * Manually schedule another attempt. The service re-checks every blocker,
     * so a stale UI cannot force a retry the domain forbids.
     */
    public function retry(Request $request, string $id): JsonResponse|DeliveryResource
    {
        $delivery = $this->deliveries->findByUuidOrFail($id);

        try {
            $updated = $this->execution->scheduleRetry($delivery, $this->actor($request));
        } catch (DeliveryException $e) {
            return $this->unprocessable($e);
        }

        return new DeliveryResource($updated->refresh());
    }

    /** Why this delivery can or cannot be retried — drives the UI affordance. */
    public function retryEligibility(string $id): JsonResponse
    {
        $delivery = $this->deliveries->findByUuidOrFail($id);

        return response()->json([
            'can_retry' => $delivery->canRetry(),
            'blockers' => $delivery->retryBlockers(),
            'attempt_count' => $delivery->attempt_count,
            'max_attempts' => $delivery->max_attempts,
            'remaining_attempts' => $delivery->remainingAttempts(),
            'retry_cutoff_date' => $delivery->retry_cutoff_date?->toDateString(),
            'requires_manual_review' => $delivery->requiresManualReview(),
        ]);
    }

    public function cancel(Request $request, string $id): JsonResponse|DeliveryResource
    {
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $delivery = $this->deliveries->findByUuidOrFail($id);

        try {
            $updated = $this->execution->cancel(
                $delivery,
                $validated['reason'] ?? null,
                $this->actor($request),
            );
        } catch (DeliveryException $e) {
            return $this->unprocessable($e);
        }

        return new DeliveryResource($updated->refresh());
    }

    /** Clears the BR-19 retry blocker raised by an address-related failure. */
    public function markAddressCorrected(Request $request, string $id): DeliveryResource
    {
        $delivery = $this->deliveries->findByUuidOrFail($id);

        return new DeliveryResource(
            $this->execution->markAddressCorrected($delivery, $this->actor($request))->refresh()
        );
    }

    public function escalate(string $id): DeliveryResource
    {
        $delivery = $this->deliveries->findByUuidOrFail($id);

        return new DeliveryResource($this->execution->escalate($delivery)->refresh());
    }

    // ── Tracking ─────────────────────────────────────────────────────────────

    /** Internal timeline: every event, including operator-only entries. */
    public function timeline(string $id): JsonResponse
    {
        $delivery = $this->deliveries->findByUuidOrFail($id);

        return TrackingEventResource::collection(
            $delivery->trackingEvents()->get()
        )->response();
    }

    /**
     * Customer-facing timeline. Redacted by the projection service — internal
     * notes, actor identities and operational metadata never reach it.
     */
    public function publicTimeline(string $id): JsonResponse
    {
        $delivery = $this->deliveries->findByUuidOrFail($id);

        return response()->json([
            'data' => $this->tracking->publicTimeline($delivery),
        ]);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function unprocessable(DeliveryException $e): JsonResponse
    {
        return response()->json(['message' => $e->getMessage()], 422);
    }

    private function companyId(Request $request): ?string
    {
        $companyId = $request->user()?->company_id;

        return $companyId === null ? null : (string) $companyId;
    }

    private function actor(Request $request): ?string
    {
        return $request->user()?->name;
    }
}
