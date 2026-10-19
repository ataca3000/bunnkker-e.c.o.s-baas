<?php

declare(strict_types=1);

namespace Modules\Organization\Teams\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use Modules\Organization\Teams\Application\DTO\TeamDTO;
use Modules\Organization\Teams\Domain\Contracts\TeamRepositoryInterface;
use Modules\Organization\Teams\Domain\Services\TeamCodeGeneratorService;

final class CreateTeamAction extends BaseAction
{
    public function __construct(
        private readonly TeamRepositoryInterface $teams,
        private readonly TeamCodeGeneratorService $codeGenerator,
    ) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $dto = $arguments[0] ?? null;

        if (! $dto instanceof TeamDTO) {
            throw new InvalidArgumentException('CreateTeamAction::execute expects a TeamDTO.');
        }

        $team = DB::transaction(function () use ($dto) {
            $code = $dto->code ?? $this->codeGenerator->next($dto->company_id);

            return $this->teams->create([
                'company_id' => $dto->company_id,
                'code' => $code,
                'name' => $dto->name,
                'leader_name' => $dto->leader_name,
                'description' => $dto->description,
                'is_active' => $dto->is_active,
            ]);
        });

        return OperationResult::success($team, 'Team created successfully.');
    }
}
