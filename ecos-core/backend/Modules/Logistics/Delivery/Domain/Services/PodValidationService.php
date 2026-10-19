<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Domain\Services;

use Illuminate\Support\Facades\DB;
use Modules\Logistics\Delivery\Domain\Enums\PodArtifactKind;
use Modules\Logistics\Delivery\Domain\Enums\PodStatus;
use Modules\Logistics\Delivery\Domain\Events\PodRejected;
use Modules\Logistics\Delivery\Domain\Events\PodValidated;
use Modules\Logistics\Delivery\Domain\Exceptions\DeliveryException;
use Modules\Logistics\Delivery\Domain\Models\DeliveryAttempt;
use Modules\Logistics\Delivery\Domain\Models\PodArtifact;
use Modules\Logistics\Delivery\Domain\Models\ProofOfDelivery;

/**
 * POD capture and validation.
 *
 * The artifact policy is snapshotted onto the POD at capture time (BR-17/18),
 * so a later policy change can never retroactively invalidate history.
 */
class PodValidationService
{
    /** Default policy: a signature plus at least one photo. */
    public const DEFAULT_REQUIRED = [
        PodArtifactKind::Signature->value,
        PodArtifactKind::Photo->value,
    ];

    /** High-value or COD deliveries additionally require an OTP confirmation. */
    public const HIGH_VALUE_REQUIRED = [
        PodArtifactKind::Signature->value,
        PodArtifactKind::Photo->value,
        PodArtifactKind::Otp->value,
    ];

    /**
     * @param  list<string>|null  $requiredArtifacts
     * @param  array<string, mixed>  $attributes
     */
    public function capture(
        DeliveryAttempt $attempt,
        array $attributes = [],
        ?array $requiredArtifacts = null,
        ?int $actorId = null,
    ): ProofOfDelivery {
        return DB::transaction(function () use ($attempt, $attributes, $requiredArtifacts, $actorId) {
            $pod = ProofOfDelivery::firstOrNew(['attempt_id' => $attempt->id]);

            if ($pod->exists && $pod->isValidated()) {
                throw DeliveryException::podImmutable();
            }

            $pod->fill($attributes + [
                'delivery_id' => $attempt->delivery_id,
                'attempt_id' => $attempt->id,
                'required_artifacts' => $requiredArtifacts ?? $pod->required_artifacts ?? self::DEFAULT_REQUIRED,
                'status' => PodStatus::Captured->value,
                'captured_at' => now(),
                'captured_by' => $actorId,
            ]);
            $pod->save();

            return $pod->refresh();
        });
    }

    /** @param array<string, mixed> $attributes */
    public function addArtifact(ProofOfDelivery $pod, array $attributes, ?int $actorId = null): PodArtifact
    {
        if ($pod->isValidated()) {
            throw DeliveryException::podImmutable();
        }

        return $pod->artifacts()->create($attributes + [
            'captured_at' => now(),
            'captured_by' => $actorId,
        ]);
    }

    /**
     * Validate the POD. Refuses while any required artifact is absent, so a
     * delivery cannot be closed on incomplete evidence.
     */
    public function validate(ProofOfDelivery $pod, ?int $actorId = null, ?string $actor = null): ProofOfDelivery
    {
        if (! $pod->status->canTransitionTo(PodStatus::Validated)) {
            throw DeliveryException::invalidPodTransition($pod->status, PodStatus::Validated);
        }

        $pod->load('artifacts');
        $missing = $pod->missingArtifacts();

        if ($missing !== []) {
            throw DeliveryException::podRequired($missing);
        }

        $validated = DB::transaction(function () use ($pod, $actorId) {
            $pod->update([
                'status' => PodStatus::Validated->value,
                'validated_at' => now(),
                'validated_by' => $actorId,
                'rejection_reason' => null,
            ]);

            return $pod->refresh();
        });

        PodValidated::dispatch($validated->delivery, $validated, $actor);

        return $validated;
    }

    public function reject(ProofOfDelivery $pod, string $reason, ?int $actorId = null, ?string $actor = null): ProofOfDelivery
    {
        if (! $pod->status->canTransitionTo(PodStatus::Rejected)) {
            throw DeliveryException::invalidPodTransition($pod->status, PodStatus::Rejected);
        }

        $rejected = DB::transaction(function () use ($pod, $reason, $actorId) {
            $pod->update([
                'status' => PodStatus::Rejected->value,
                'rejection_reason' => $reason,
                'validated_by' => $actorId,
            ]);

            return $pod->refresh();
        });

        PodRejected::dispatch($rejected->delivery, $rejected, $actor);

        return $rejected;
    }
}
