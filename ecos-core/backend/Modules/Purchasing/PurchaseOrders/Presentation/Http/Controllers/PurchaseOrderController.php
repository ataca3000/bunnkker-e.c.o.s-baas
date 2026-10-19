<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseOrders\Presentation\Http\Controllers;

use App\Core\Company\CurrentCompanyService;
use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Purchasing\PurchaseOrders\Application\Actions\ApprovePurchaseOrderAction;
use Modules\Purchasing\PurchaseOrders\Application\Actions\CancelPurchaseOrderAction;
use Modules\Purchasing\PurchaseOrders\Application\Actions\CreatePurchaseOrderAction;
use Modules\Purchasing\PurchaseOrders\Application\Actions\DeletePurchaseOrderAction;
use Modules\Purchasing\PurchaseOrders\Application\Actions\GetPurchaseOrderAction;
use Modules\Purchasing\PurchaseOrders\Application\Actions\ListPurchaseOrdersAction;
use Modules\Purchasing\PurchaseOrders\Application\Actions\SubmitPurchaseOrderAction;
use Modules\Purchasing\PurchaseOrders\Application\Actions\UpdatePurchaseOrderAction;
use Modules\Purchasing\PurchaseOrders\Application\DTO\PurchaseOrderDTO;
use Modules\Purchasing\PurchaseOrders\Presentation\Http\Requests\StorePurchaseOrderRequest;
use Modules\Purchasing\PurchaseOrders\Presentation\Http\Requests\UpdatePurchaseOrderRequest;
use Modules\Purchasing\PurchaseOrders\Presentation\Http\Resources\PurchaseOrderResource;

final class PurchaseOrderController extends Controller
{
    use HasApiResponse;

    public function __construct(private readonly CurrentCompanyService $currentCompany) {}

    public function index(Request $request, ListPurchaseOrdersAction $action): JsonResponse
    {
        $filters = [
            'search' => $request->query('search'),
            'supplier_id' => $request->query('supplier_id'),
            'status' => $request->query('status', 'all'),
            'date_from' => $request->query('date_from'),
            'date_to' => $request->query('date_to'),
            'sort_by' => $request->query('sort_by', 'created_at'),
            'sort_dir' => $request->query('sort_dir', 'desc'),
            'per_page' => $request->query('per_page', 10),
            'company_id' => $this->currentCompany->id(),
        ];

        $paginator = $action->execute($filters)->data();

        return $this->success([
            'items' => PurchaseOrderResource::collection($paginator->items()),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    public function show(string $purchaseOrder, GetPurchaseOrderAction $action): JsonResponse
    {
        $model = $action->execute($purchaseOrder)->data();

        return $this->success(new PurchaseOrderResource($model));
    }

    public function store(StorePurchaseOrderRequest $request, CreatePurchaseOrderAction $action): JsonResponse
    {
        $result = $action->execute(PurchaseOrderDTO::fromArray($request->validated()));

        return $this->created(new PurchaseOrderResource($result->data()), $result->message());
    }

    public function update(
        UpdatePurchaseOrderRequest $request,
        string $purchaseOrder,
        UpdatePurchaseOrderAction $action,
    ): JsonResponse {
        $result = $action->execute($purchaseOrder, PurchaseOrderDTO::fromArray($request->validated()));

        return $this->updated(new PurchaseOrderResource($result->data()), $result->message());
    }

    public function destroy(string $purchaseOrder, DeletePurchaseOrderAction $action): JsonResponse
    {
        $result = $action->execute($purchaseOrder);

        return $this->deleted($result->message() ?? 'Purchase order deleted successfully.');
    }

    public function submit(string $purchaseOrder, SubmitPurchaseOrderAction $action): JsonResponse
    {
        $result = $action->execute($purchaseOrder);

        return $this->updated(new PurchaseOrderResource($result->data()), $result->message());
    }

    public function approve(string $purchaseOrder, ApprovePurchaseOrderAction $action): JsonResponse
    {
        $result = $action->execute($purchaseOrder);

        return $this->updated(new PurchaseOrderResource($result->data()), $result->message());
    }

    public function cancel(string $purchaseOrder, CancelPurchaseOrderAction $action): JsonResponse
    {
        $result = $action->execute($purchaseOrder);

        return $this->updated(new PurchaseOrderResource($result->data()), $result->message());
    }
}
