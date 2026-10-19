<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Actions;

use App\Core\Audit\AuditService;
use App\Core\Timeline\TimelineService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Operations\Preparation\Domain\Enums\ExceptionSeverity;
use Modules\Operations\Preparation\Domain\Enums\ExceptionStatus;
use Modules\Operations\Preparation\Domain\Enums\QualityStatus;
use Modules\Operations\Preparation\Domain\Events\ExceptionRaised;
use Modules\Operations\Preparation\Domain\Models\PreparationException;
use Modules\Operations\Preparation\Domain\Models\PreparedProductsPool;

final class UpdatePoolQualityAction
{
    public function __construct(
        private readonly AuditService $audit,
        private readonly TimelineService $timeline,
    ) {}

    public function execute(
        PreparedProductsPool $pool,
        string $qualityResult,
        string $actorId,
        ?string $notes = null,
    ): PreparedProductsPool {
        return DB::transaction(function () use ($pool, $qualityResult, $actorId, $notes): PreparedProductsPool {
            $old = $pool->quality_status;

            $pool->update([
                'quality_status' => $qualityResult,
                'quality_checked_at' => now(),
                'quality_checked_by' => (int) $actorId,
                'updated_by' => (int) $actorId,
            ]);

            $waveId = $pool->preparation_wave_id;

            if ($qualityResult === QualityStatus::Failed->value) {
                $exception = PreparationException::create([
                    'id' => Str::uuid()->toString(),
                    'company_id' => $pool->company_id,
                    'preparation_wave_id' => $waveId,
                    'exception_type' => 'quality_failed',
                    'severity' => ExceptionSeverity::Blocking->value,
                    'status' => ExceptionStatus::Open->value,
                    'entity_type' => 'PreparedProductsPool',
                    'entity_id' => $pool->id,
                    'description' => "Quality check failed for {$pool->sku_snapshot}".($notes ? ": {$notes}" : ''),
                    'raised_by' => $actorId,
                    'raised_at' => now(),
                    'created_by' => $actorId,
                    'updated_by' => $actorId,
                ]);

                event(new ExceptionRaised(
                    waveId: $waveId,
                    companyId: $pool->company_id,
                    exceptionId: $exception->id,
                    exceptionType: 'quality_failed',
                    severity: ExceptionSeverity::Blocking->value,
                    entityType: 'PreparedProductsPool',
                    entityId: $pool->id,
                    description: $exception->description,
                    raisedBy: $actorId,
                    raisedAt: now()->toIso8601String(),
                ));
            }

            $this->timeline->record(
                companyId: $pool->company_id,
                subjectType: 'PreparedProductsPool',
                subjectId: $pool->id,
                eventType: 'pool.quality_check',
                title: "Quality {$qualityResult} for {$pool->sku_snapshot}",
                description: $notes,
                actorId: (int) $actorId,
                sourceModule: 'Operations.Preparation',
                metadata: ['wave_id' => $waveId, 'result' => $qualityResult],
            );

            $this->audit->record(
                action: 'pool.quality_check',
                entityType: 'PreparedProductsPool',
                entityId: $pool->id,
                companyId: $pool->company_id,
                userId: (int) $actorId,
                oldValues: ['quality_status' => $old],
                newValues: ['quality_status' => $qualityResult],
                metadata: $notes ? ['notes' => $notes] : [],
            );

            return $pool->fresh() ?? $pool;
        });
    }
}
