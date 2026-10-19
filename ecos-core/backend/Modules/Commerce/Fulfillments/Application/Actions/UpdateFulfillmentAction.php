<?php

declare(strict_types=1);

namespace Modules\Commerce\Fulfillments\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Commerce\Fulfillments\Application\DTO\FulfillmentDTO;
use Modules\Commerce\Fulfillments\Domain\Contracts\FulfillmentRepositoryInterface;
use Modules\Commerce\Fulfillments\Domain\Exceptions\FulfillmentNotFoundException;

final class UpdateFulfillmentAction extends BaseAction
{
    public function __construct(private readonly FulfillmentRepositoryInterface $fulfillments) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $id = (string) ($arguments[0] ?? '');

        /** @var FulfillmentDTO $dto */
        $dto = $arguments[1];

        $fulfillment = $this->fulfillments->findById($id);

        if ($fulfillment === null) {
            throw new FulfillmentNotFoundException($id);
        }

        $fulfillment = $this->fulfillments->update($fulfillment, $dto->fulfillmentAttributes(), $dto->lineAttributes());

        return OperationResult::success($fulfillment, 'Fulfillment updated successfully.');
    }
}
