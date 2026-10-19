<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Actions;

use App\Core\Audit\AuditService;
use App\Core\Timeline\TimelineService;
use Illuminate\Support\Facades\DB;
use Modules\Operations\Preparation\Domain\Enums\WaveStatus;
use Modules\Operations\Preparation\Domain\Models\PreparationMaterialRequirement;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;

final class ResolveShortageAction
{
    public function __construct(
        private readonly AuditService $audit,
        private readonly TimelineService $timeline,
    ) {}

    /**
     * Resolve a material shortage — either supervisor override or re-check after stock arrival.
     *
     * @param  list<string>  $requirementIds  IDs of MaterialRequirements to mark resolved.
     *                                        Pass empty array to resolve ALL shortages on the wave.
     */
    public function execute(
        PreparationWave $wave,
        string $actorId,
        array $requirementIds = [],
        ?string $resolutionNotes = null,
    ): PreparationWave {
        return DB::transaction(function () use ($wave, $actorId, $requirementIds, $resolutionNotes): PreparationWave {
            $query = PreparationMaterialRequirement::where('preparation_wave_id', $wave->id)
                ->where('shortage', true)
                ->where('resolved', false);

            if (! empty($requirementIds)) {
                $query->whereIn('id', $requirementIds);
            }

            $query->update([
                'resolved' => true,
                'resolved_by' => $actorId,
                'resolved_at' => now(),
                'resolution_notes' => $resolutionNotes,
                'updated_by' => $actorId,
            ]);

            $unresolvedCount = PreparationMaterialRequirement::where('preparation_wave_id', $wave->id)
                ->where('shortage', true)
                ->where('resolved', false)
                ->count();

            if ($unresolvedCount === 0 && $wave->status === WaveStatus::ShortageBlocked) {
                $wave->update([
                    'status' => WaveStatus::Planning->value,
                    'updated_by' => $actorId,
                ]);
            }

            $this->timeline->record(
                companyId: $wave->company_id,
                subjectType: 'PreparationWave',
                subjectId: $wave->id,
                eventType: 'shortage.resolved',
                title: 'Shortage resolved by supervisor',
                description: $resolutionNotes ?? 'Supervisor acknowledged shortage and unblocked wave',
                actorId: (int) $actorId,
                sourceModule: 'Operations.Preparation',
            );

            $this->audit->record(
                action: 'shortage.resolved',
                entityType: 'PreparationWave',
                entityId: $wave->id,
                companyId: $wave->company_id,
                userId: (int) $actorId,
                newValues: ['resolved' => true, 'resolution_notes' => $resolutionNotes],
                metadata: ['requirement_ids' => $requirementIds],
            );

            return $wave->fresh() ?? $wave;
        });
    }
}
