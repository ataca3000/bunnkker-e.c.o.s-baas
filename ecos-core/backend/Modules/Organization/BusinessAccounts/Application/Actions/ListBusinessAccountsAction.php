<?php

declare(strict_types=1);

namespace Modules\Organization\BusinessAccounts\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Organization\BusinessAccounts\Domain\Contracts\BusinessAccountRepositoryInterface;

final class ListBusinessAccountsAction extends BaseAction
{
    public function __construct(private readonly BusinessAccountRepositoryInterface $accounts) {}

    /** @param array<string, mixed> ...$arguments */
    public function execute(mixed ...$arguments): OperationResult
    {
        $filters = $arguments[0] ?? [];

        return OperationResult::success($this->accounts->paginate($filters));
    }
}
