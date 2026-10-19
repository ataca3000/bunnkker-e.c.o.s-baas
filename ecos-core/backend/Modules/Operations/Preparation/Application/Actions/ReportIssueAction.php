<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Actions;

use App\Core\FeatureFlags\FeatureFlagService;
use Modules\Operations\Preparation\Application\DTOs\ReportIssueDTO;
use Modules\Operations\Preparation\Domain\Enums\PreparationIssueType;
use Modules\Operations\Preparation\Domain\Events\IssueReported;
use Modules\Operations\Preparation\Domain\Models\PreparationException;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;
use RuntimeException;

final class ReportIssueAction
{
    public function __construct(private readonly FeatureFlagService $flags) {}

    public function execute(ReportIssueDTO $dto): PreparationException
    {
        $this->guardWorkflowStage($dto->companyId);

        $exception = PreparationException::create([
            'company_id' => $dto->companyId,
            'preparation_wave_id' => $dto->waveId,
            'exception_type' => $dto->issueType->value,
            'issue_type' => $dto->issueType->value,
            'severity' => $dto->issueType->defaultSeverity()->value,
            'entity_type' => $dto->entityType,
            'entity_id' => $dto->entityId,
            'description' => $dto->description,
            'status' => 'open',
            'raised_by' => $dto->actorId,
            'raised_at' => now(),
            'created_by' => $dto->actorId,
            'updated_by' => $dto->actorId,
        ]);

        event(new IssueReported($exception, $dto->actorId));

        return $exception;
    }

    /** @deprecated Use execute(ReportIssueDTO) instead. Kept for any legacy call sites. */
    public function executeRaw(
        PreparationWave $wave,
        PreparationIssueType $issueType,
        string $description,
        string $actorId,
        ?string $entityType = null,
        ?string $entityId = null,
    ): PreparationException {
        return $this->execute(new ReportIssueDTO(
            waveId: $wave->id,
            companyId: $wave->company_id,
            actorId: $actorId,
            issueType: $issueType,
            description: $description,
            entityType: $entityType,
            entityId: $entityId,
        ));
    }

    private function guardWorkflowStage(string $companyId): void
    {
        if (! $this->flags->isEnabled('workflow.stages.preparation', $companyId)) {
            throw new RuntimeException('Preparation OS workflow stage is not enabled.');
        }
    }
}
