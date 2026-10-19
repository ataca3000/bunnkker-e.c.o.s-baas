<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Actions;

use App\Core\FeatureFlags\FeatureFlagService;
use Illuminate\Support\Facades\DB;
use Modules\Operations\Preparation\Application\DTOs\CreateSessionDTO;
use Modules\Operations\Preparation\Domain\Events\SessionCreated;
use Modules\Operations\Preparation\Domain\Models\PreparationSession;
use RuntimeException;

final class CreateSessionAction
{
    public function __construct(private readonly FeatureFlagService $flags) {}

    public function execute(CreateSessionDTO $dto): PreparationSession
    {
        $this->guardWorkflowStage($dto->companyId);

        return DB::transaction(function () use ($dto): PreparationSession {
            $sessionNumber = $this->generateSessionNumber($dto->companyId);

            $session = PreparationSession::create([
                'company_id' => $dto->companyId,
                'warehouse_id' => $dto->warehouseId,
                'session_number' => $sessionNumber,
                'planning_date' => $dto->planningDate,
                'status' => 'draft',
                'operator_id' => $dto->operatorId,
                'supervisor_id' => $dto->supervisorId,
                'notes' => $dto->notes,
                'created_by' => $dto->actorId,
                'updated_by' => $dto->actorId,
            ]);

            event(new SessionCreated($session, $dto->actorId));

            return $session;
        });
    }

    private function generateSessionNumber(string $companyId): string
    {
        $prefix = 'PSESS-'.now()->format('Ym').'-';

        $last = PreparationSession::where('company_id', $companyId)
            ->where('session_number', 'like', $prefix.'%')
            ->orderByDesc('session_number')
            ->value('session_number');

        $seq = $last ? ((int) substr($last, strlen($prefix)) + 1) : 1;

        return $prefix.str_pad((string) $seq, 4, '0', STR_PAD_LEFT);
    }

    private function guardWorkflowStage(string $companyId): void
    {
        if (! $this->flags->isEnabled('workflow.stages.preparation', $companyId)) {
            throw new RuntimeException('Preparation OS workflow stage is not enabled.');
        }
    }
}
