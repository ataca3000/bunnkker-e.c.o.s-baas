<?php

declare(strict_types=1);

namespace Modules\Organization\BusinessAccounts\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use Modules\Organization\BusinessAccounts\Application\DTO\BusinessAccountDTO;
use Modules\Organization\BusinessAccounts\Domain\Contracts\BusinessAccountRepositoryInterface;
use Modules\Organization\BusinessAccounts\Domain\Services\BusinessAccountCodeGeneratorService;

final class CreateBusinessAccountAction extends BaseAction
{
    public function __construct(
        private readonly BusinessAccountRepositoryInterface $accounts,
        private readonly BusinessAccountCodeGeneratorService $codeGenerator,
    ) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $dto = $arguments[0] ?? null;

        if (! $dto instanceof BusinessAccountDTO) {
            throw new InvalidArgumentException('CreateBusinessAccountAction::execute expects a BusinessAccountDTO.');
        }

        $account = DB::transaction(function () use ($dto) {
            $code = $dto->code ?? $this->codeGenerator->next($dto->company_id);

            return $this->accounts->create([
                'company_id' => $dto->company_id,
                'brand_id' => $dto->brand_id,
                'code' => $code,
                'name' => $dto->name,
                'provider' => $dto->provider,
                'status' => $dto->status,
                'description' => $dto->description,
                'logo' => $dto->logo,
                'oauth_config' => $dto->oauth_config,
                'api_keys' => $dto->api_keys,
                'webhook_config' => $dto->webhook_config,
                'sync_settings' => $dto->sync_settings,
                'external_metadata' => $dto->external_metadata,
            ]);
        });

        return OperationResult::success($account, 'Business account created successfully.');
    }
}
