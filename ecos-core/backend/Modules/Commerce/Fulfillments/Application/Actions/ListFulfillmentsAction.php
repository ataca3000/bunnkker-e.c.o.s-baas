<?php

declare(strict_types=1);

namespace Modules\Commerce\Fulfillments\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Commerce\Fulfillments\Domain\Contracts\FulfillmentRepositoryInterface;

final class ListFulfillmentsAction extends BaseAction
{
    public function __construct(private readonly FulfillmentRepositoryInterface $fulfillments) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $filters = is_array($arguments[0] ?? null) ? $arguments[0] : [];

        return OperationResult::success($this->fulfillments->paginate($filters));
    }
}
