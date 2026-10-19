<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Modules\Logistics\Delivery\Domain\Enums\PodArtifactKind;
use Modules\Logistics\Delivery\Domain\Exceptions\DeliveryException;
use Modules\Logistics\Delivery\Domain\Models\DeliveryAttempt;
use Modules\Logistics\Delivery\Domain\Models\ProofOfDelivery;
use Modules\Logistics\Delivery\Domain\Services\PodValidationService;
use Modules\Logistics\Delivery\Presentation\Http\Resources\PodResource;

/**
 * Proof of Delivery — capture, evidence, validation.
 *
 * Capturing and validating are separate permissions on purpose: the person who
 * took the photo should not be the person who signs it off.
 *
 * The required-artifact list is snapshotted onto the POD at capture time, so a
 * later policy change cannot retroactively invalidate historic evidence.
 */
class DeliveryPodController extends Controller
{
    public function __construct(
        private readonly PodValidationService $pods,
    ) {}

    public function show(string $deliveryId, string $attemptId): PodResource
    {
        $attempt = $this->attempt($deliveryId, $attemptId);

        return new PodResource($attempt->pod()->with('artifacts')->firstOrFail());
    }

    /**
     * Capture (or re-capture) the POD for an attempt.
     *
     * Upsert semantics — always 200, never 201, so the same call has the same
     * contract whether or not evidence was captured earlier in the visit.
     */
    public function capture(Request $request, string $deliveryId, string $attemptId): JsonResponse
    {
        $validated = $request->validate([
            'recipient_name' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'required_artifacts' => ['nullable', 'array'],
            'required_artifacts.*' => [Rule::in(PodArtifactKind::values())],
        ]);

        $required = $validated['required_artifacts'] ?? null;
        unset($validated['required_artifacts']);

        try {
            $pod = $this->pods->capture(
                $this->attempt($deliveryId, $attemptId),
                array_filter($validated, static fn ($v) => $v !== null),
                $required,
                $request->user()?->id,
            );
        } catch (DeliveryException $e) {
            return $this->unprocessable($e);
        }

        return (new PodResource($pod->load('artifacts')))->response()->setStatusCode(200);
    }

    public function addArtifact(Request $request, string $deliveryId, string $attemptId): JsonResponse|PodResource
    {
        $validated = $request->validate([
            'kind' => ['required', Rule::in(PodArtifactKind::values())],
            'file_path' => ['nullable', 'string', 'max:500'],
            'file_name' => ['nullable', 'string', 'max:255'],
            'mime_type' => ['nullable', 'string', 'max:100'],
            'size_bytes' => ['nullable', 'integer', 'min:0'],
            'reference' => ['nullable', 'string', 'max:255'],
        ]);

        $pod = $this->pod($deliveryId, $attemptId);

        try {
            $this->pods->addArtifact($pod, $validated, $request->user()?->id);
        } catch (DeliveryException $e) {
            return $this->unprocessable($e);
        }

        return new PodResource($pod->refresh()->load('artifacts'));
    }

    /** Refuses while any required artifact is missing — BR-7. */
    public function validatePod(Request $request, string $deliveryId, string $attemptId): JsonResponse|PodResource
    {
        try {
            $pod = $this->pods->validate(
                $this->pod($deliveryId, $attemptId),
                $request->user()?->id,
                $request->user()?->name,
            );
        } catch (DeliveryException $e) {
            return $this->unprocessable($e);
        }

        return new PodResource($pod->load('artifacts'));
    }

    public function reject(Request $request, string $deliveryId, string $attemptId): JsonResponse|PodResource
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        try {
            $pod = $this->pods->reject(
                $this->pod($deliveryId, $attemptId),
                $validated['reason'],
                $request->user()?->id,
                $request->user()?->name,
            );
        } catch (DeliveryException $e) {
            return $this->unprocessable($e);
        }

        return new PodResource($pod->load('artifacts'));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function attempt(string $deliveryId, string $attemptId): DeliveryAttempt
    {
        return DeliveryAttempt::query()
            ->where('uuid', $attemptId)
            ->whereHas('delivery', fn ($q) => $q->where('uuid', $deliveryId))
            ->firstOrFail();
    }

    private function pod(string $deliveryId, string $attemptId): ProofOfDelivery
    {
        return $this->attempt($deliveryId, $attemptId)->pod()->with('artifacts')->firstOrFail();
    }

    private function unprocessable(DeliveryException $e): JsonResponse
    {
        return response()->json(['message' => $e->getMessage()], 422);
    }
}
