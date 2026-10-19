<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Illuminate\Support\Facades\Auth;
use Modules\Commerce\Orders\Domain\Contracts\OrderRepositoryInterface;
use Modules\Commerce\Orders\Domain\Exceptions\OrderNotFoundException;

final class GetOrderAction extends BaseAction
{
    public function __construct(private readonly OrderRepositoryInterface $orders) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $id = (string) ($arguments[0] ?? '');
        $order = $this->orders->findById($id);

        if ($order === null) {
            throw new OrderNotFoundException($id);
        }

        // K-G1: enforce company isolation — return 404 (not 403) to avoid leaking existence
        $actorCompanyId = Auth::user()?->company_id;
        if ($actorCompanyId !== null && $order->company_id !== $actorCompanyId) {
            throw new OrderNotFoundException($id);
        }

        return OperationResult::success($order);
    }
}
