<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseMaterials\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Purchasing\PurchaseMaterials\Application\Actions\ApprovePurchaseMaterialAction;
use Modules\Purchasing\PurchaseMaterials\Application\Actions\AssignBuyerAction;
use Modules\Purchasing\PurchaseMaterials\Application\Actions\CancelPurchaseMaterialAction;
use Modules\Purchasing\PurchaseMaterials\Application\Actions\CreatePurchaseMaterialAction;
use Modules\Purchasing\PurchaseMaterials\Application\Actions\DeletePurchaseMaterialAction;
use Modules\Purchasing\PurchaseMaterials\Application\Actions\GetProductProcurementPanelAction;
use Modules\Purchasing\PurchaseMaterials\Application\Actions\GetPurchaseMaterialAction;
use Modules\Purchasing\PurchaseMaterials\Application\Actions\GetPurchaseMaterialStatsAction;
use Modules\Purchasing\PurchaseMaterials\Application\Actions\HoldPurchaseMaterialAction;
use Modules\Purchasing\PurchaseMaterials\Application\Actions\ListPurchaseMaterialsAction;
use Modules\Purchasing\PurchaseMaterials\Application\Actions\RejectPurchaseMaterialAction;
use Modules\Purchasing\PurchaseMaterials\Application\Actions\SelectLineSupplierAction;
use Modules\Purchasing\PurchaseMaterials\Application\Actions\SubmitPurchaseMaterialAction;
use Modules\Purchasing\PurchaseMaterials\Application\Actions\UpdatePurchaseMaterialAction;
use Modules\Purchasing\PurchaseMaterials\Application\DTO\PurchaseMaterialDTO;
use Modules\Purchasing\PurchaseMaterials\Domain\Services\PurchaseMaterialRuleEngine;
use Modules\Purchasing\PurchaseMaterials\Presentation\Http\Requests\StorePurchaseMaterialRequest;
use Modules\Purchasing\PurchaseMaterials\Presentation\Http\Requests\UpdatePurchaseMaterialRequest;
use Modules\Purchasing\PurchaseMaterials\Presentation\Http\Resources\PurchaseMaterialResource;

final class PurchaseMaterialController extends Controller
{
    use HasApiResponse;

    public function index(Request $request, ListPurchaseMaterialsAction $action): JsonResponse
    {
        $filters = [
            'search' => $request->query('search'),
            'status' => $request->query('status', 'all'),
            'priority' => $request->query('priority', 'all'),
            'warehouse_id' => $request->query('warehouse_id'),
            'company_id' => $request->query('company_id'),
            'channel_id' => $request->query('channel_id'),
            'assigned_buyer' => $request->query('assigned_buyer'),
            'date_from' => $request->query('date_from'),
            'date_to' => $request->query('date_to'),
            'sort_by' => $request->query('sort_by', 'created_at'),
            'sort_dir' => $request->query('sort_dir', 'desc'),
            'per_page' => $request->query('per_page', 15),
        ];

        $paginator = $action->execute($filters)->data();

        return $this->success([
            'items' => PurchaseMaterialResource::collection($paginator->items()),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    public function show(string $purchaseMaterial, GetPurchaseMaterialAction $action): JsonResponse
    {
        $model = $action->execute($purchaseMaterial)->data();

        return $this->success(new PurchaseMaterialResource($model));
    }

    public function store(StorePurchaseMaterialRequest $request, CreatePurchaseMaterialAction $action): JsonResponse
    {
        $result = $action->execute(PurchaseMaterialDTO::fromArray($request->validated()), $request);

        return $this->created(new PurchaseMaterialResource($result->data()), $result->message());
    }

    public function update(
        UpdatePurchaseMaterialRequest $request,
        string $purchaseMaterial,
        UpdatePurchaseMaterialAction $action,
    ): JsonResponse {
        $result = $action->execute($purchaseMaterial, PurchaseMaterialDTO::fromArray($request->validated()), $request);

        return $this->updated(new PurchaseMaterialResource($result->data()), $result->message());
    }

    public function destroy(string $purchaseMaterial, DeletePurchaseMaterialAction $action): JsonResponse
    {
        $result = $action->execute($purchaseMaterial);

        return $this->deleted($result->message() ?? 'Purchase material deleted.');
    }

    public function submit(string $purchaseMaterial, Request $request, SubmitPurchaseMaterialAction $action): JsonResponse
    {
        $result = $action->execute($purchaseMaterial, $request);

        return $this->updated(new PurchaseMaterialResource($result->data()), $result->message());
    }

    public function approve(string $purchaseMaterial, Request $request, ApprovePurchaseMaterialAction $action): JsonResponse
    {
        $result = $action->execute($purchaseMaterial, $request);

        return $this->updated(new PurchaseMaterialResource($result->data()), $result->message());
    }

    public function reject(string $purchaseMaterial, Request $request, RejectPurchaseMaterialAction $action): JsonResponse
    {
        $result = $action->execute(
            $purchaseMaterial,
            $request->input('reason'),
            $request,
        );

        return $this->updated(new PurchaseMaterialResource($result->data()), $result->message());
    }

    public function hold(string $purchaseMaterial, Request $request, HoldPurchaseMaterialAction $action): JsonResponse
    {
        $result = $action->execute($purchaseMaterial, $request);

        return $this->updated(new PurchaseMaterialResource($result->data()), $result->message());
    }

    public function cancel(string $purchaseMaterial, Request $request, CancelPurchaseMaterialAction $action): JsonResponse
    {
        $result = $action->execute($purchaseMaterial, $request);

        return $this->updated(new PurchaseMaterialResource($result->data()), $result->message());
    }

    public function stats(Request $request, GetPurchaseMaterialStatsAction $action): JsonResponse
    {
        $stats = $action->execute(
            $request->query('company_id'),
            $request->query('warehouse_id'),
        );

        return $this->success($stats);
    }

    public function assignBuyer(string $purchaseMaterial, Request $request, AssignBuyerAction $action): JsonResponse
    {
        $request->validate(['buyer_name' => ['required', 'string', 'max:255']]);

        $result = $action->execute($purchaseMaterial, (string) $request->input('buyer_name'), $request);

        return $this->updated(new PurchaseMaterialResource($result->data()), $result->message());
    }

    public function procurementPanel(
        string $productId,
        Request $request,
        GetProductProcurementPanelAction $panelAction,
        PurchaseMaterialRuleEngine $ruleEngine,
    ): JsonResponse {
        $requestedQty = (float) ($request->query('requested_qty') ?? 0);
        $requiredDate = $request->query('required_date');

        $panel = $panelAction->execute(
            $productId,
            $request->query('warehouse_id'),
            $requestedQty,
            $requiredDate,
        );

        // When a specific quantity is provided, supplement with procurement rule engine
        if ($requestedQty > 0) {
            $panel['recommendations'] = $ruleEngine->evaluate($panel, $requestedQty, $requiredDate);
        }

        return $this->success($panel);
    }

    public function selectLineSupplier(
        string $purchaseMaterial,
        string $line,
        Request $request,
        SelectLineSupplierAction $action,
    ): JsonResponse {
        $request->validate([
            'supplier_id' => ['required', 'uuid', 'exists:suppliers,id'],
            'agreed_price' => ['nullable', 'numeric', 'min:0'],
            'agreed_qty' => ['nullable', 'numeric', 'min:0.0001'],
            'lead_time_days' => ['nullable', 'integer', 'min:0'],
        ]);

        $result = $action->execute(
            $purchaseMaterial,
            $line,
            (string) $request->input('supplier_id'),
            $request->input('agreed_price') !== null ? (float) $request->input('agreed_price') : null,
            $request->input('agreed_qty') !== null ? (float) $request->input('agreed_qty') : null,
            $request->input('lead_time_days') !== null ? (int) $request->input('lead_time_days') : null,
            $request,
        );

        return $this->updated($result->data(), $result->message());
    }
}
