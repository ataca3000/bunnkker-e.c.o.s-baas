<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Actions;

use App\Core\Audit\AuditService;
use App\Core\Timeline\TimelineService;
use Illuminate\Support\Facades\DB;
use Modules\Operations\Preparation\Domain\Events\WorkerReleased;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;
use Modules\Operations\Preparation\Domain\Models\PreparationWaveWorker;

final class ReleaseWorkerAction
{
    public function __construct(
        private readonly AuditService $audit,
        private readonly TimelineService $timeline,
    ) {}

    public function execute(
        PreparationWave $wave,
        string $userId,
        string $actorId,
    ): void {
        DB::transaction(function () use ($wave, $userId, $actorId): void {
            $now = now();

            /** @var PreparationWaveWorker|null $worker */
            $worker = PreparationWaveWorker::where('preparation_wave_id', $wave->id)
                ->where('user_id', $userId)
                ->whereNull('released_at')
                ->first();

            if (! $worker) {
                return;
            }

            $worker->update(['released_at' => $now, 'released_by' => (int) $actorId]);

            /** @var \App\Models\User|null $workerUser */
            $workerUser = DB::table('users')->where('id', $userId)->first(['name']);
            $userName = $workerUser?->name ?? $userId;

            event(new WorkerReleased(
                waveId: $wave->id,
                waveNumber: $wave->wave_number,
                companyId: $wave->company_id,
                userId: $userId,
                userName: $userName,
                role: $worker->role,
                releasedBy: $actorId,
                releasedAt: $now->toIso8601String(),
            ));

            $this->timeline->record(
                companyId: $wave->company_id,
                subjectType: 'PreparationWave',
                subjectId: $wave->id,
                eventType: 'worker.released',
                title: "{$userName} released from wave",
                actorId: (int) $actorId,
                sourceModule: 'Operations.Preparation',
                metadata: ['user_id' => $userId, 'role' => $worker->role],
            );

            $this->audit->record(
                action: 'worker.released',
                entityType: 'PreparationWave',
                entityId: $wave->id,
                companyId: $wave->company_id,
                userId: (int) $actorId,
                oldValues: ['released_at' => null],
                newValues: ['released_at' => $now->toIso8601String(), 'user_id' => $userId],
            );
        });
    }
}
