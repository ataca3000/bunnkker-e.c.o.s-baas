<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Actions;

use App\Core\Audit\AuditService;
use App\Core\Timeline\TimelineService;
use Illuminate\Support\Facades\DB;
use Modules\Operations\Preparation\Domain\Enums\WaveStatus;
use Modules\Operations\Preparation\Domain\Exceptions\InvalidWaveStatusTransitionException;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;

final class ApproveWaveAction
{
    public function __construct(
        private readonly AuditService $audit,
        private readonly TimelineService $timeline,
    ) {}

    public function execute(PreparationWave $wave, string $actorId, ?string $notes = null): PreparationWave
    {
        if (! in_array($wave->status, [WaveStatus::Planning, WaveStatus::ShortageBlocked], true)) {
            throw InvalidWaveStatusTransitionException::from($wave->status, WaveStatus::Planning);
        }

        return DB::transaction(function () use ($wave, $actorId, $notes): PreparationWave {
            $old = $wave->toArray();

            $wave->update([
                'approved_by' => $actorId,
                'approved_at' => now(),
                'updated_by' => $actorId,
            ]);

            $this->timeline->record(
                companyId: $wave->company_id,
                subjectType: 'PreparationWave',
                subjectId: $wave->id,
                eventType: 'wave.approved',
                title: "Wave {$wave->wave_number} approved",
                description: $notes ?? 'Wave approved by supervisor',
                actorId: (int) $actorId,
                sourceModule: 'Operations.Preparation',
            );

            $this->audit->record(
                action: 'wave.approved',
                entityType: 'PreparationWave',
                entityId: $wave->id,
                companyId: $wave->company_id,
                userId: (int) $actorId,
                oldValues: ['approved_by' => null, 'approved_at' => null],
                newValues: ['approved_by' => $actorId, 'approved_at' => now()->toIso8601String()],
                metadata: $notes ? ['notes' => $notes] : [],
            );

            return $wave->fresh() ?? $wave;
        });
    }
}
