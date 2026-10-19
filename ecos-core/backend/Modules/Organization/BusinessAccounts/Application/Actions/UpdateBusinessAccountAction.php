<?php

declare(strict_types=1);

namespace Modules\Organization\BusinessAccounts\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use InvalidArgumentException;
use Modules\Organization\BusinessAccounts\Application\DTO\BusinessAccountDTO;
use Modules\Organization\BusinessAccounts\Domain\Contracts\BusinessAccountRepositoryInterface;
use Modules\Organization\BusinessAccounts\Domain\Exceptions\BusinessAccountNotFoundException;

final class UpdateBusinessAccountAction extends BaseAction
{
    public function __construct(private readonly BusinessAccountRepositoryInterface $accounts) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $id = $arguments[0] ?? null;
        $dto = $arguments[1] ?? null;

        if (! is_string($id) || ! $dto instanceof BusinessAccountDTO) {
            throw new InvalidArgumentException('UpdateBusinessAccountAction::execute expects (string $id, BusinessAccountDTO $dto).');
        }

        $account = $this->accounts->findById($id);
        if ($account === null) {
            throw new BusinessAccountNotFoundException($id);
        }

        $account = $this->accounts->update($account, [
            'brand_id' => $dto->brand_id,
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

        return OperationResult::success($account, 'Business account updated successfully.');
    }
}
