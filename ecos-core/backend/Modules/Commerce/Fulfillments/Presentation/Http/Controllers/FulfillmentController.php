<?php

declare(strict_types=1);

namespace Modules\Commerce\Fulfillments\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Commerce\Fulfillments\Application\Actions\CancelFulfillmentAction;
use Modules\Commerce\Fulfillments\Application\Actions\CreateFulfillmentAction;
use Modules\Commerce\Fulfillments\Application\Actions\DeleteFulfillmentAction;
use Modules\Commerce\Fulfillments\Application\Actions\FulfillFulfillmentAction;
use Modules\Commerce\Fulfillments\Application\Actions\GetFulfillmentAction;
use Modules\Commerce\Fulfillments\Application\Actions\ListFulfillmentsAction;
use Modules\Commerce\Fulfillments\Application\Actions\UpdateFulfillmentAction;
use Modules\Commerce\Fulfillments\Application\DTO\FulfillmentDTO;
use Modules\Commerce\Fulfillments\Presentation\Http\Requests\StoreFulfillmentRequest;
use Modules\Commerce\Fulfillments\Presentation\Http\Requests\UpdateFulfillmentRequest;
use Modules\Commerce\Fulfillments\Presentation\Http\Resources\FulfillmentResource;
use Modules\Commerce\StockSync\Application\Actions\SyncStockAction;
use Throwable;

final class FulfillmentController extends Controller
{
    use HasApiResponse;

    public function index(Request $request, ListFulfillmentsAction $action): JsonResponse
    {
        $filters = [
            'search' => $request->query('search'),
            'order_id' => $request->query('order_id'),
            'warehouse_id' => $request->query('warehouse_id'),
            'status' => $request->query('status', 'all'),
            'sort_by' => $request->query('sort_by', 'created_at'),
            'sort_dir' => $request->query('sort_dir', 'desc'),
            'per_page' => $request->query('per_page', 10),
        ];

        $paginator = $action->execute($filters)->data();

        return $this->success([
            'items' => FulfillmentResource::collection($paginator->items()),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    public function show(string $fulfillment, GetFulfillmentAction $action): JsonResponse
    {
        $model = $action->execute($fulfillment)->data();

        return $this->success(new FulfillmentResource($model));
    }

    public function store(StoreFulfillmentRequest $request, CreateFulfillmentAction $action): JsonResponse
    {
        $result = $action->execute(FulfillmentDTO::fromArray($request->validated()));

        return $this->created(new FulfillmentResource($result->data()), $result->message());
    }

    public function update(
        UpdateFulfillmentRequest $request,
        string $fulfillment,
        UpdateFulfillmentAction $action,
    ): JsonResponse {
        $result = $action->execute($fulfillment, FulfillmentDTO::fromArray($request->validated()));

        return $this->updated(new FulfillmentResource($result->data()), $result->message());
    }

    public function destroy(string $fulfillment, DeleteFulfillmentAction $action): JsonResponse
    {
        $result = $action->execute($fulfillment);

        return $this->deleted($result->message() ?? 'Fulfillment deleted successfully.');
    }

    public function fulfill(string $fulfillment, FulfillFulfillmentAction $fulfillAction, SyncStockAction $syncAction): JsonResponse
    {
        $result = $fulfillAction->execute($fulfillment);

        $fulfilled = $result->data();
        $productIds = $fulfilled->lines->pluck('product_id')->all();

        Channel::query()
            ->where('is_active', true)
            ->where('sync_stock', true)
            ->get()
            ->each(function (Channel $channel) use ($syncAction, $productIds): void {
                try {
                    $syncAction->execute($channel->id, $productIds);
                } catch (Throwable) {
                    // Swallow sync errors — fulfillment succeeded
                }
            });

        return $this->updated(new FulfillmentResource($result->data()), $result->message());
    }

    public function cancel(string $fulfillment, CancelFulfillmentAction $action): JsonResponse
    {
        $result = $action->execute($fulfillment);

        return $this->updated(new FulfillmentResource($result->data()), $result->message());
    }
}
