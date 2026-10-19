<?php

declare(strict_types=1);

namespace Modules\Organization\BusinessAccounts\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use InvalidArgumentException;
use Modules\Organization\BusinessAccounts\Domain\Contracts\BusinessAccountRepositoryInterface;
use Modules\Organization\BusinessAccounts\Domain\Exceptions\BusinessAccountNotFoundException;

final class DeleteBusinessAccountAction extends BaseAction
{
    public function __construct(private readonly BusinessAccountRepositoryInterface $accounts) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $id = $arguments[0] ?? null;

        if (! is_string($id)) {
            throw new InvalidArgumentException('DeleteBusinessAccountAction::execute expects a string id.');
        }

        $account = $this->accounts->findById($id);
        if ($account === null) {
            throw new BusinessAccountNotFoundException($id);
        }

        $this->accounts->delete($account);

        return OperationResult::success(null, 'Business account deleted successfully.');
    }
}
