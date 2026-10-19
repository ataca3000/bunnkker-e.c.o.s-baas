<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Actions;

use App\Core\Audit\AuditService;
use App\Core\Timeline\TimelineService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Operations\Preparation\Domain\Events\WorkerAssigned;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;
use Modules\Operations\Preparation\Domain\Models\PreparationWaveWorker;

final class AssignWorkerAction
{
    public function __construct(
        private readonly AuditService $audit,
        private readonly TimelineService $timeline,
    ) {}

    public function execute(
        PreparationWave $wave,
        string $userId,
        string $role,
        string $actorId,
    ): PreparationWaveWorker {
        return DB::transaction(function () use ($wave, $userId, $role, $actorId): PreparationWaveWorker {
            $now = now();

            $existing = PreparationWaveWorker::where('preparation_wave_id', $wave->id)
                ->where('user_id', $userId)
                ->whereNull('released_at')
                ->first();

            if ($existing) {
                return $existing;
            }

            /** @var \App\Models\User|null $workerUser */
            $workerUser = DB::table('users')->where('id', $userId)->first(['name']);
            $userName = $workerUser?->name ?? $userId;

            $worker = PreparationWaveWorker::create([
                'id' => Str::uuid()->toString(),
                'company_id' => $wave->company_id,
                'preparation_wave_id' => $wave->id,
                'user_id' => (int) $userId,
                'role' => $role,
                'assigned_by' => (int) $actorId,
                'assigned_at' => $now,
            ]);

            event(new WorkerAssigned(
                waveId: $wave->id,
                waveNumber: $wave->wave_number,
                companyId: $wave->company_id,
                userId: $userId,
                userName: $userName,
                role: $role,
                assignedBy: $actorId,
                assignedAt: $now->toIso8601String(),
            ));

            $this->timeline->record(
                companyId: $wave->company_id,
                subjectType: 'PreparationWave',
                subjectId: $wave->id,
                eventType: 'worker.assigned',
                title: "{$userName} assigned as {$role}",
                actorId: (int) $actorId,
                sourceModule: 'Operations.Preparation',
                metadata: ['user_id' => $userId, 'role' => $role],
            );

            $this->audit->record(
                action: 'worker.assigned',
                entityType: 'PreparationWave',
                entityId: $wave->id,
                companyId: $wave->company_id,
                userId: (int) $actorId,
                newValues: ['user_id' => $userId, 'role' => $role],
            );

            return $worker;
        });
    }
}
