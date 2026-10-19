<?php

declare(strict_types=1);

namespace Modules\Purchasing\SupplierReturns\Presentation\Http\Controllers;

use App\Core\Company\CurrentCompanyService;
use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Purchasing\SupplierReturns\Application\Actions\ReverseSupplierReturnInventoryAction;
use Modules\Purchasing\SupplierReturns\Domain\Enums\SupplierReturnStatus;
use Modules\Purchasing\SupplierReturns\Domain\Models\SupplierReturn;
use Modules\Purchasing\SupplierReturns\Presentation\Http\Requests\StoreSupplierReturnRequest;
use Modules\Purchasing\SupplierReturns\Presentation\Http\Resources\SupplierReturnResource;

final class SupplierReturnController extends Controller
{
    use HasApiResponse;

    public function __construct(
        private readonly CurrentCompanyService $currentCompany,
        private readonly ReverseSupplierReturnInventoryAction $reverseInventory,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = SupplierReturn::query()
            ->with(['supplier', 'warehouse'])
            ->latest();

        // Company isolation: scope to the authenticated user's company via warehouse
        if ($companyId = $this->currentCompany->id()) {
            $query->whereHas('warehouse', fn ($q) => $q->where('company_id', $companyId));
        }

        if ($request->filled('search')) {
            $q = $request->query('search');
            $query->where('return_number', 'like', "%{$q}%");
        }

        if ($request->filled('status') && $request->query('status') !== 'all') {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('supplier_id')) {
            $query->where('supplier_id', $request->query('supplier_id'));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('return_date', '>=', $request->query('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('return_date', '<=', $request->query('date_to'));
        }

        $perPage = (int) $request->query('per_page', 15);
        $paginator = $query->paginate($perPage);

        return $this->success([
            'items' => SupplierReturnResource::collection($paginator->items()),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    public function store(StoreSupplierReturnRequest $request): JsonResponse
    {
        $return = SupplierReturn::query()->create(
            array_merge($request->safe()->except('lines'), [
                'return_number' => (new SupplierReturn)->generateReturnNumber(),
                'status' => SupplierReturnStatus::Draft,
                'total_return_value' => 0,
            ]),
        );

        $total = 0;
        foreach ($request->input('lines') as $lineData) {
            $totalCost = round((float) $lineData['unit_cost'] * (float) $lineData['return_quantity'], 4);
            $total += $totalCost;
            $return->lines()->create(array_merge($lineData, ['total_cost' => $totalCost]));
        }

        $return->update(['total_return_value' => $total]);
        $return->load(['supplier', 'warehouse', 'lines.product']);

        return $this->success(new SupplierReturnResource($return), 'Supplier return created', 201);
    }

    public function show(SupplierReturn $supplierReturn): JsonResponse
    {
        $supplierReturn->load(['supplier', 'warehouse', 'lines.product']);

        return $this->success(new SupplierReturnResource($supplierReturn));
    }

    public function update(StoreSupplierReturnRequest $request, SupplierReturn $supplierReturn): JsonResponse
    {
        if ($supplierReturn->status !== SupplierReturnStatus::Draft) {
            return $this->error('Only draft returns can be edited', 422);
        }

        $supplierReturn->update($request->safe()->except('lines'));

        $supplierReturn->lines()->delete();
        $total = 0;
        foreach ($request->input('lines') as $lineData) {
            $totalCost = round((float) $lineData['unit_cost'] * (float) $lineData['return_quantity'], 4);
            $total += $totalCost;
            $supplierReturn->lines()->create(array_merge($lineData, ['total_cost' => $totalCost]));
        }
        $supplierReturn->update(['total_return_value' => $total]);
        $supplierReturn->load(['supplier', 'warehouse', 'lines.product']);

        return $this->success(new SupplierReturnResource($supplierReturn));
    }

    public function submit(SupplierReturn $supplierReturn): JsonResponse
    {
        if (! $supplierReturn->status->canTransitionTo(SupplierReturnStatus::WaitingApproval)) {
            return $this->error('Return cannot be submitted in its current state', 422);
        }

        $supplierReturn->update([
            'status' => SupplierReturnStatus::WaitingApproval,
            'submitted_by' => auth()->id(),
            'submitted_at' => now(),
        ]);

        return $this->success(new SupplierReturnResource($supplierReturn->fresh(['supplier', 'warehouse'])));
    }

    public function approve(SupplierReturn $supplierReturn): JsonResponse
    {
        if (! $supplierReturn->status->canTransitionTo(SupplierReturnStatus::Approved)) {
            return $this->error('Return cannot be approved in its current state', 422);
        }

        $supplierReturn->update([
            'status' => SupplierReturnStatus::Approved,
            'approved_by' => auth()->id(),
            'approved_at' => now(),
        ]);

        // Reverse inventory: decrement on_hand_qty for each returned line
        $supplierReturn->load('lines.product', 'warehouse');
        $this->reverseInventory->execute($supplierReturn);

        return $this->success(new SupplierReturnResource($supplierReturn->fresh(['supplier', 'warehouse'])));
    }

    public function reject(Request $request, SupplierReturn $supplierReturn): JsonResponse
    {
        $request->validate(['reason' => ['required', 'string', 'max:500']]);

        if (! $supplierReturn->status->canTransitionTo(SupplierReturnStatus::Rejected)) {
            return $this->error('Return cannot be rejected in its current state', 422);
        }

        $supplierReturn->update([
            'status' => SupplierReturnStatus::Rejected,
            'rejection_reason' => $request->input('reason'),
        ]);

        return $this->success(new SupplierReturnResource($supplierReturn->fresh()));
    }

    public function markSent(SupplierReturn $supplierReturn): JsonResponse
    {
        if (! $supplierReturn->status->canTransitionTo(SupplierReturnStatus::Sent)) {
            return $this->error('Return cannot be marked as sent in its current state', 422);
        }

        $supplierReturn->update(['status' => SupplierReturnStatus::Sent]);

        return $this->success(new SupplierReturnResource($supplierReturn->fresh()));
    }

    public function creditPending(SupplierReturn $supplierReturn): JsonResponse
    {
        if (! $supplierReturn->status->canTransitionTo(SupplierReturnStatus::CreditPending)) {
            return $this->error('Cannot transition to Credit Pending', 422);
        }

        $supplierReturn->update(['status' => SupplierReturnStatus::CreditPending]);

        return $this->success(new SupplierReturnResource($supplierReturn->fresh()));
    }

    public function complete(Request $request, SupplierReturn $supplierReturn): JsonResponse
    {
        if (! $supplierReturn->status->canTransitionTo(SupplierReturnStatus::Completed)) {
            return $this->error('Return cannot be completed in its current state', 422);
        }

        $data = array_filter([
            'status' => SupplierReturnStatus::Completed,
            'completed_by' => auth()->id(),
            'completed_at' => now(),
            'credit_amount' => $request->input('credit_amount'),
            'debit_note_number' => $request->input('debit_note_number'),
            'credit_received_date' => $request->input('credit_received_date'),
        ], fn ($v) => $v !== null);

        $supplierReturn->update($data);

        return $this->success(new SupplierReturnResource($supplierReturn->fresh(['supplier', 'warehouse'])));
    }

    public function cancel(SupplierReturn $supplierReturn): JsonResponse
    {
        if (! $supplierReturn->status->canTransitionTo(SupplierReturnStatus::Cancelled)) {
            return $this->error('Return cannot be cancelled in its current state', 422);
        }

        $supplierReturn->update(['status' => SupplierReturnStatus::Cancelled]);

        return $this->success(new SupplierReturnResource($supplierReturn->fresh()));
    }

    public function destroy(SupplierReturn $supplierReturn): JsonResponse
    {
        if ($supplierReturn->status !== SupplierReturnStatus::Draft) {
            return $this->error('Only draft returns can be deleted', 422);
        }

        $supplierReturn->delete();

        return $this->success(null, 'Supplier return deleted');
    }

    public function stats(): JsonResponse
    {
        $companyId = $this->currentCompany->id();
        $scope = function ($q) use ($companyId): void {
            if ($companyId) {
                $q->whereHas('warehouse', fn ($wq) => $wq->where('company_id', $companyId));
            }
        };

        $stats = [
            'total' => SupplierReturn::query()->tap($scope)->count(),
            'draft' => SupplierReturn::query()->tap($scope)->where('status', 'draft')->count(),
            'waiting' => SupplierReturn::query()->tap($scope)->where('status', 'waiting_approval')->count(),
            'approved' => SupplierReturn::query()->tap($scope)->where('status', 'approved')->count(),
            'credit_pending' => SupplierReturn::query()->tap($scope)->where('status', 'credit_pending')->count(),
            'completed' => SupplierReturn::query()->tap($scope)->where('status', 'completed')->count(),
            'total_value' => (float) SupplierReturn::query()->tap($scope)->whereIn('status', ['approved', 'sent', 'credit_pending', 'completed'])->sum('total_return_value'),
        ];

        return $this->success($stats);
    }
}
