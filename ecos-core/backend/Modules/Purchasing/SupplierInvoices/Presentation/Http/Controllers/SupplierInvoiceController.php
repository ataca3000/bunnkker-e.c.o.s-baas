<?php

declare(strict_types=1);

namespace Modules\Purchasing\SupplierInvoices\Presentation\Http\Controllers;

use App\Core\Company\CurrentCompanyService;
use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Purchasing\SupplierInvoices\Application\Services\PostSupplierInvoiceService;
use Modules\Purchasing\SupplierInvoices\Domain\Enums\SupplierInvoiceStatus;
use Modules\Purchasing\SupplierInvoices\Domain\Models\SupplierInvoice;
use Modules\Purchasing\SupplierInvoices\Domain\Models\SupplierInvoiceLine;
use Modules\Purchasing\SupplierInvoices\Presentation\Http\Requests\StoreSupplierInvoiceRequest;
use Modules\Purchasing\SupplierInvoices\Presentation\Http\Resources\SupplierInvoiceResource;
use Throwable;

final class SupplierInvoiceController extends Controller
{
    use HasApiResponse;

    public function __construct(
        private readonly PostSupplierInvoiceService $postService,
        private readonly CurrentCompanyService $currentCompany,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = SupplierInvoice::query()
            ->with(['supplier', 'warehouse'])
            ->latest('invoice_date');

        // Company isolation: scope to the authenticated user's company via warehouse
        if ($companyId = $this->currentCompany->id()) {
            $query->whereHas('warehouse', fn ($q) => $q->where('company_id', $companyId));
        }

        if ($request->filled('search')) {
            $q = $request->query('search');
            $query->where(function ($sub) use ($q): void {
                $sub->where('invoice_number', 'like', "%{$q}%")
                    ->orWhere('supplier_invoice_ref', 'like', "%{$q}%");
            });
        }

        if ($request->filled('status') && $request->query('status') !== 'all') {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('supplier_id')) {
            $query->where('supplier_id', $request->query('supplier_id'));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('invoice_date', '>=', $request->query('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('invoice_date', '<=', $request->query('date_to'));
        }

        $perPage = (int) $request->query('per_page', 15);
        $paginator = $query->paginate($perPage);

        return $this->success([
            'items' => SupplierInvoiceResource::collection($paginator->items()),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    public function store(StoreSupplierInvoiceRequest $request): JsonResponse
    {
        // Resolve currency from company settings; fall back to null (DB stores null when not configured)
        $currency = $request->input('currency');
        if ($currency === null) {
            $warehouse = Warehouse::query()
                ->with('company:id,currency')
                ->find($request->input('warehouse_id'));
            $currency = $warehouse?->company?->currency;
        }

        $invoice = SupplierInvoice::query()->create(
            array_merge($request->safe()->except('lines'), [
                'invoice_number' => (new SupplierInvoice)->generateInvoiceNumber(),
                'status' => SupplierInvoiceStatus::Draft,
                'created_by' => auth()->id(),
                'currency' => $currency,
                'exchange_rate' => $request->input('exchange_rate', 1),
                'freight_amount' => $request->input('freight_amount', 0),
                'additional_costs' => $request->input('additional_costs', 0),
                'discount_amount' => $request->input('discount_amount', 0),
            ]),
        );

        $this->syncLines($invoice, $request->input('lines'));
        $invoice->recalculateTotals();
        $invoice->save();

        $invoice->load(['supplier', 'warehouse', 'lines.product']);

        return $this->success(new SupplierInvoiceResource($invoice), 'Supplier invoice created', 201);
    }

    public function show(SupplierInvoice $supplierInvoice): JsonResponse
    {
        $supplierInvoice->load(['supplier', 'warehouse', 'lines.product']);

        return $this->success(new SupplierInvoiceResource($supplierInvoice));
    }

    public function update(StoreSupplierInvoiceRequest $request, SupplierInvoice $supplierInvoice): JsonResponse
    {
        if (! in_array($supplierInvoice->status, [SupplierInvoiceStatus::Draft, SupplierInvoiceStatus::Failed])) {
            return $this->error('Only draft or failed invoices can be edited', 422);
        }

        $supplierInvoice->update($request->safe()->except('lines'));
        $this->syncLines($supplierInvoice, $request->input('lines'));
        $supplierInvoice->recalculateTotals();
        $supplierInvoice->save();

        $supplierInvoice->load(['supplier', 'warehouse', 'lines.product']);

        return $this->success(new SupplierInvoiceResource($supplierInvoice));
    }

    public function validate(SupplierInvoice $supplierInvoice): JsonResponse
    {
        if ($supplierInvoice->status !== SupplierInvoiceStatus::Draft) {
            return $this->error('Only draft invoices can be validated', 422);
        }

        if ($supplierInvoice->lines->isEmpty()) {
            return $this->error('Invoice must have at least one line', 422);
        }

        $supplierInvoice->update(['status' => SupplierInvoiceStatus::Validated]);

        return $this->success(new SupplierInvoiceResource($supplierInvoice->fresh()));
    }

    public function post(SupplierInvoice $supplierInvoice): JsonResponse
    {
        try {
            $this->postService->execute($supplierInvoice);
        } catch (Throwable $e) {
            return $this->error('Posting failed: '.$e->getMessage(), 422);
        }

        return $this->success(
            new SupplierInvoiceResource($supplierInvoice->fresh(['supplier', 'warehouse', 'lines.product'])),
            'Invoice posted successfully',
        );
    }

    public function cancel(SupplierInvoice $supplierInvoice): JsonResponse
    {
        if (! $supplierInvoice->status->canCancel()) {
            return $this->error('Invoice cannot be cancelled in its current state', 422);
        }

        $supplierInvoice->update(['status' => SupplierInvoiceStatus::Cancelled]);

        return $this->success(new SupplierInvoiceResource($supplierInvoice->fresh()));
    }

    public function destroy(SupplierInvoice $supplierInvoice): JsonResponse
    {
        if ($supplierInvoice->status !== SupplierInvoiceStatus::Draft) {
            return $this->error('Only draft invoices can be deleted', 422);
        }

        $supplierInvoice->delete();

        return $this->success(null, 'Invoice deleted');
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
            'total' => SupplierInvoice::query()->tap($scope)->count(),
            'draft' => SupplierInvoice::query()->tap($scope)->where('status', 'draft')->count(),
            'validated' => SupplierInvoice::query()->tap($scope)->where('status', 'validated')->count(),
            'posted' => SupplierInvoice::query()->tap($scope)->where('status', 'posted')->count(),
            'failed' => SupplierInvoice::query()->tap($scope)->where('status', 'failed')->count(),
            'total_value' => (float) SupplierInvoice::query()->tap($scope)->where('status', 'posted')->sum('grand_total'),
            'pending_value' => (float) SupplierInvoice::query()->tap($scope)->whereIn('status', ['draft', 'validated'])->sum('grand_total'),
        ];

        return $this->success($stats);
    }

    /** @param array<int, array<string, mixed>> $lines */
    private function syncLines(SupplierInvoice $invoice, array $lines): void
    {
        $invoice->lines()->delete();

        foreach ($lines as $lineData) {
            $qty = (float) $lineData['quantity'];
            $price = (float) $lineData['unit_price'];
            $taxRate = (float) ($lineData['tax_rate'] ?? 0);
            $discount = (float) ($lineData['discount_amount'] ?? 0);
            $subtotal = round($qty * $price, 4);
            $taxAmt = round($subtotal * $taxRate / 100, 4);
            $total = round($subtotal + $taxAmt - $discount, 4);

            SupplierInvoiceLine::query()->create(array_merge($lineData, [
                'supplier_invoice_id' => $invoice->id,
                'tax_rate' => $taxRate,
                'tax_amount' => $taxAmt,
                'discount_amount' => $discount,
                'line_total' => $total,
            ]));
        }
    }
}
