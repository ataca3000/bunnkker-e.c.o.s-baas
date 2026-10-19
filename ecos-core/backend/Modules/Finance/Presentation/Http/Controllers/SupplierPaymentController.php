<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Modules\Finance\Allocation\Domain\Services\AllocationEngine;
use Modules\Finance\Payables\Domain\Models\SupplierBill;
use Modules\Finance\Payables\Domain\Models\SupplierPayment;
use Modules\Finance\Payables\Domain\Services\AccountsPayableService;
use Modules\Finance\Presentation\Http\Controllers\Concerns\ResolvesFinanceContext;

/**
 * Supplier payments (money out): create (maker) → approve (checker) → post →
 * allocate. The approve step is a separate authority — segregation of duties for
 * money leaving the business.
 */
class SupplierPaymentController extends Controller
{
    use ResolvesFinanceContext;

    public function __construct(
        private readonly AccountsPayableService $ap,
        private readonly AllocationEngine $allocations,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $payments = SupplierPayment::query()
            ->where('company_id', $this->companyId($request))
            ->when($request->filled('supplier_id'), fn ($q) => $q->where('supplier_id', $request->string('supplier_id')))
            ->latest('id')
            ->limit(100)
            ->get()
            ->map(fn (SupplierPayment $p) => $this->payload($p));

        return response()->json(['data' => $payments]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'supplier_id' => ['required', 'string'],
            'number' => ['required', 'string', 'max:60'],
            'payment_date' => ['required', 'date'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'funding_account_id' => ['required', 'string'], // uuid
            'currency' => ['nullable', 'string', 'size:3'],
            'description' => ['nullable', 'string', 'max:500'],
        ]);

        $payment = $this->ap->createPayment(
            companyId: $this->companyId($request),
            supplierId: $validated['supplier_id'],
            number: $validated['number'],
            paymentDate: Carbon::parse($validated['payment_date']),
            amount: (float) $validated['amount'],
            fundingAccountId: $this->accountId($request, $validated['funding_account_id']),
            currency: $validated['currency'] ?? 'EGP',
            description: $validated['description'] ?? null,
            createdBy: $this->actorId($request),
        );

        return response()->json(['data' => $this->payload($payment)], 201);
    }

    /** Checker: approve a draft payment (must differ from the maker). */
    public function approve(Request $request, string $uuid): JsonResponse
    {
        $payment = $this->ap->approvePayment($this->find($request, $uuid), (int) $this->actorId($request));

        return response()->json(['data' => $this->payload($payment)]);
    }

    public function post(Request $request, string $uuid): JsonResponse
    {
        $payment = $this->ap->postPayment($this->find($request, $uuid), $this->actorId($request));

        return response()->json(['data' => $this->payload($payment)]);
    }

    public function allocate(Request $request, string $uuid): JsonResponse
    {
        $validated = $request->validate([
            'bill_id' => ['required', 'string'], // bill uuid
            'amount' => ['required', 'numeric', 'gt:0'],
        ]);

        $payment = $this->find($request, $uuid);
        $bill = $this->findBill($request, $validated['bill_id']);

        $allocation = $this->allocations->allocatePayment($payment, $bill, (float) $validated['amount'], $this->actorId($request));

        return response()->json(['data' => [
            'id' => $allocation->uuid,
            'payment_id' => $payment->uuid,
            'bill_id' => $bill->uuid,
            'amount' => (float) $allocation->amount,
            'payment_unallocated' => $payment->fresh()->unallocatedAmount(),
            'bill_outstanding' => $bill->fresh()->outstanding(),
        ]], 201);
    }

    public function autoAllocate(Request $request, string $uuid): JsonResponse
    {
        $payment = $this->find($request, $uuid);
        $created = $this->allocations->autoAllocatePayment($payment, $this->actorId($request));

        return response()->json(['data' => [
            'allocations' => count($created),
            'payment_unallocated' => $payment->fresh()->unallocatedAmount(),
        ]]);
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private function find(Request $request, string $uuid): SupplierPayment
    {
        return SupplierPayment::query()
            ->where('company_id', $this->companyId($request))
            ->where('uuid', $uuid)
            ->firstOrFail();
    }

    private function findBill(Request $request, string $uuid): SupplierBill
    {
        return SupplierBill::query()
            ->where('company_id', $this->companyId($request))
            ->where('uuid', $uuid)
            ->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function payload(SupplierPayment $p): array
    {
        return [
            'id' => $p->uuid,
            'supplier_id' => $p->supplier_id,
            'number' => $p->number,
            'payment_date' => $p->payment_date?->toDateString(),
            'amount' => (float) $p->amount,
            'currency' => $p->currency,
            'status' => $p->status->value,
            'unallocated' => $p->isPosted() ? $p->unallocatedAmount() : null,
            'journal_entry_id' => $p->journal_entry_id,
            'approved_by' => $p->approved_by,
            'approved_at' => $p->approved_at?->toIso8601String(),
            'posted_at' => $p->posted_at?->toIso8601String(),
        ];
    }
}
