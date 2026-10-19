<?php

declare(strict_types=1);

namespace Modules\POS\Application\Infrastructure\Adapters;

use App\Core\Responses\OperationResult;
use Modules\Commerce\Orders\Application\Actions\CreateOrderAction;
use Modules\Commerce\Orders\Application\DTO\OrderDTO;
use Modules\POS\Application\Contracts\OrderCreationPortInterface;

/**
 * Adapter: wraps Commerce's CreateOrderAction behind OrderCreationPortInterface.
 *
 * The POS listener depends on the port; this adapter is the production binding.
 */
final class CommerceOrderCreationAdapter implements OrderCreationPortInterface
{
    public function __construct(private readonly CreateOrderAction $action) {}

    public function create(OrderDTO $dto): OperationResult
    {
        return $this->action->execute($dto);
    }
}
