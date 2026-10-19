<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Modules\Finance\Allocation\Domain\Services\AllocationEngine;
use Modules\Finance\Presentation\Http\Controllers\Concerns\ResolvesFinanceContext;
use Modules\Finance\Receivables\Domain\Models\CustomerInvoice;
use Modules\Finance\Receivables\Domain\Models\CustomerReceipt;
use Modules\Finance\Receivables\Domain\Services\AccountsReceivableService;

/**
 * Customer receipts (money in), their posting, allocation to invoices, and the
 * write-off workflow. Allocation is a pure subledger relationship — it never
 * posts a journal.
 */
class CustomerReceiptController extends Controller
{
    use ResolvesFinanceContext;

    public function __construct(
        private readonly AccountsReceivableService $ar,
        private readonly AllocationEngine $allocations,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $receipts = CustomerReceipt::query()
            ->where('company_id', $this->companyId($request))
            ->when($request->filled('customer_id'), fn ($q) => $q->where('customer_id', $request->string('customer_id')))
            ->latest('id')
            ->limit(100)
            ->get()
            ->map(fn (CustomerReceipt $r) => $this->payload($r));

        return response()->json(['data' => $receipts]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => ['required', 'string'],
            'number' => ['required', 'string', 'max:60'],
            'receipt_date' => ['required', 'date'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'deposit_account_id' => ['required', 'string'], // uuid
            'currency' => ['nullable', 'string', 'size:3'],
            'description' => ['nullable', 'string', 'max:500'],
        ]);

        $receipt = $this->ar->createReceipt(
            companyId: $this->companyId($request),
            customerId: $validated['customer_id'],
            number: $validated['number'],
            receiptDate: Carbon::parse($validated['receipt_date']),
            amount: (float) $validated['amount'],
            depositAccountId: $this->accountId($request, $validated['deposit_account_id']),
            currency: $validated['currency'] ?? 'EGP',
            description: $validated['description'] ?? null,
            createdBy: $this->actorId($request),
        );

        return response()->json(['data' => $this->payload($receipt)], 201);
    }

    public function post(Request $request, string $uuid): JsonResponse
    {
        $receipt = $this->ar->postReceipt($this->find($request, $uuid), $this->actorId($request));

        return response()->json(['data' => $this->payload($receipt)]);
    }

    /** Allocate part of a receipt to one invoice. */
    public function allocate(Request $request, string $uuid): JsonResponse
    {
        $validated = $request->validate([
            'invoice_id' => ['required', 'string'], // invoice uuid
            'amount' => ['required', 'numeric', 'gt:0'],
        ]);

        $receipt = $this->find($request, $uuid);
        $invoice = $this->findInvoice($request, $validated['invoice_id']);

        $allocation = $this->allocations->allocateReceipt($receipt, $invoice, (float) $validated['amount'], $this->actorId($request));

        return response()->json(['data' => [
            'id' => $allocation->uuid,
            'receipt_id' => $receipt->uuid,
            'invoice_id' => $invoice->uuid,
            'amount' => (float) $allocation->amount,
            'receipt_unallocated' => $receipt->fresh()->unallocatedAmount(),
            'invoice_outstanding' => $invoice->fresh()->outstanding(),
        ]], 201);
    }

    /** Auto-allocate a receipt across the customer's open invoices (FIFO). */
    public function autoAllocate(Request $request, string $uuid): JsonResponse
    {
        $receipt = $this->find($request, $uuid);
        $created = $this->allocations->autoAllocateReceipt($receipt, $this->actorId($request));

        return response()->json(['data' => [
            'allocations' => count($created),
            'receipt_unallocated' => $receipt->fresh()->unallocatedAmount(),
        ]]);
    }

    /** Write off the outstanding balance of a posted invoice to a bad-debt account. */
    public function writeOff(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'invoice_id' => ['required', 'string'],
            'bad_debt_account_id' => ['required', 'string'], // uuid
            'amount' => ['nullable', 'numeric', 'gt:0'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $invoice = $this->findInvoice($request, $validated['invoice_id']);

        $receipt = $this->ar->writeOff(
            invoice: $invoice,
            badDebtAccountId: $this->accountId($request, $validated['bad_debt_account_id']),
            allocations: $this->allocations,
            amount: isset($validated['amount']) ? (float) $validated['amount'] : null,
            actorId: $this->actorId($request),
            reason: $validated['reason'] ?? null,
        );

        return response()->json(['data' => [
            'write_off_receipt' => $receipt->uuid,
            'invoice_outstanding' => $invoice->fresh()->outstanding(),
        ]], 201);
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private function find(Request $request, string $uuid): CustomerReceipt
    {
        return CustomerReceipt::query()
            ->where('company_id', $this->companyId($request))
            ->where('uuid', $uuid)
            ->firstOrFail();
    }

    private function findInvoice(Request $request, string $uuid): CustomerInvoice
    {
        return CustomerInvoice::query()
            ->where('company_id', $this->companyId($request))
            ->where('uuid', $uuid)
            ->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function payload(CustomerReceipt $r): array
    {
        return [
            'id' => $r->uuid,
            'customer_id' => $r->customer_id,
            'number' => $r->number,
            'receipt_date' => $r->receipt_date?->toDateString(),
            'amount' => (float) $r->amount,
            'currency' => $r->currency,
            'status' => $r->status->value,
            'unallocated' => $r->isPosted() ? $r->unallocatedAmount() : null,
            'journal_entry_id' => $r->journal_entry_id,
            'posted_at' => $r->posted_at?->toIso8601String(),
        ];
    }
}
