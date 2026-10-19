<?php

declare(strict_types=1);

namespace Modules\Commerce\Fulfillments\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Commerce\Fulfillments\Domain\Contracts\FulfillmentRepositoryInterface;
use Modules\Commerce\Fulfillments\Domain\Exceptions\FulfillmentNotFoundException;

final class GetFulfillmentAction extends BaseAction
{
    public function __construct(private readonly FulfillmentRepositoryInterface $fulfillments) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $id = (string) ($arguments[0] ?? '');
        $fulfillment = $this->fulfillments->findById($id);

        if ($fulfillment === null) {
            throw new FulfillmentNotFoundException($id);
        }

        return OperationResult::success($fulfillment);
    }
}
