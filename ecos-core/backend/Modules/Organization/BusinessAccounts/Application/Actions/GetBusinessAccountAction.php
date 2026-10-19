<?php

declare(strict_types=1);

namespace Modules\Organization\BusinessAccounts\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use InvalidArgumentException;
use Modules\Organization\BusinessAccounts\Domain\Contracts\BusinessAccountRepositoryInterface;
use Modules\Organization\BusinessAccounts\Domain\Exceptions\BusinessAccountNotFoundException;

final class GetBusinessAccountAction extends BaseAction
{
    public function __construct(private readonly BusinessAccountRepositoryInterface $accounts) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $id = $arguments[0] ?? null;

        if (! is_string($id)) {
            throw new InvalidArgumentException('GetBusinessAccountAction::execute expects a string id.');
        }

        $account = $this->accounts->findById($id);
        if ($account === null) {
            throw new BusinessAccountNotFoundException($id);
        }

        return OperationResult::success($account);
    }
}
