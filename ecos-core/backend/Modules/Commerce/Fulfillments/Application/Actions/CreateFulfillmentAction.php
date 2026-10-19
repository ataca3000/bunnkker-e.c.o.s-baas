<?php

declare(strict_types=1);

namespace Modules\Commerce\Fulfillments\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Commerce\Fulfillments\Application\DTO\FulfillmentDTO;
use Modules\Commerce\Fulfillments\Domain\Contracts\FulfillmentRepositoryInterface;

final class CreateFulfillmentAction extends BaseAction
{
    public function __construct(private readonly FulfillmentRepositoryInterface $fulfillments) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        /** @var FulfillmentDTO $dto */
        $dto = $arguments[0];

        $attributes = $dto->fulfillmentAttributes();
        $attributes['fulfillment_number'] = $this->fulfillments->nextFulfillmentNumber();

        $fulfillment = $this->fulfillments->create($attributes, $dto->lineAttributes());

        return OperationResult::success($fulfillment, 'Fulfillment created successfully.');
    }
}
