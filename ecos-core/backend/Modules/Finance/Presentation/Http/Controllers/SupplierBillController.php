<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Modules\Finance\Payables\Domain\Enums\SupplierDocumentType;
use Modules\Finance\Payables\Domain\Models\SupplierBill;
use Modules\Finance\Payables\Domain\Services\AccountsPayableService;
use Modules\Finance\Presentation\Http\Controllers\Concerns\ResolvesFinanceContext;

/**
 * Supplier bills, credit notes and debit notes. Draft → post; a posted document
 * is immutable. Posting requests a journal from the Posting Engine — AP never
 * writes the ledger.
 */
class SupplierBillController extends Controller
{
    use ResolvesFinanceContext;

    public function __construct(private readonly AccountsPayableService $ap) {}

    public function index(Request $request): JsonResponse
    {
        $docs = SupplierBill::query()
            ->where('company_id', $this->companyId($request))
            ->when($request->filled('supplier_id'), fn ($q) => $q->where('supplier_id', $request->string('supplier_id')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->latest('id')
            ->limit(100)
            ->get()
            ->map(fn (SupplierBill $b) => $this->payload($b));

        return response()->json(['data' => $docs]);
    }

    public function show(Request $request, string $uuid): JsonResponse
    {
        return response()->json(['data' => $this->payload($this->find($request, $uuid)->load('lines'), true)]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'supplier_id' => ['required', 'string'],
            'document_type' => ['nullable', Rule::in(['bill', 'credit_note', 'debit_note'])],
            'number' => ['required', 'string', 'max:60'],
            'document_date' => ['required', 'date'],
            'due_date' => ['nullable', 'date'],
            'currency' => ['nullable', 'string', 'size:3'],
            'description' => ['nullable', 'string', 'max:500'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.expense_account_id' => ['required', 'string'], // uuid
            'lines.*.description' => ['nullable', 'string', 'max:500'],
            'lines.*.quantity' => ['nullable', 'numeric'],
            'lines.*.unit_price' => ['nullable', 'numeric'],
            'lines.*.net_amount' => ['nullable', 'numeric'],
            'lines.*.tax_code_id' => ['nullable', 'integer'],
            'lines.*.cost_center_id' => ['nullable', 'integer'],
            'lines.*.branch_id' => ['nullable', 'string'],
        ]);

        $lines = $this->resolveLineAccounts($request, $validated['lines'], 'expense_account_id');

        $bill = $this->ap->createDocument(
            companyId: $this->companyId($request),
            supplierId: $validated['supplier_id'],
            number: $validated['number'],
            documentDate: Carbon::parse($validated['document_date']),
            lines: $lines,
            type: SupplierDocumentType::from($validated['document_type'] ?? 'bill'),
            dueDate: isset($validated['due_date']) ? Carbon::parse($validated['due_date']) : null,
            currency: $validated['currency'] ?? 'EGP',
            description: $validated['description'] ?? null,
            createdBy: $this->actorId($request),
        );

        return response()->json(['data' => $this->payload($bill->load('lines'), true)], 201);
    }

    public function post(Request $request, string $uuid): JsonResponse
    {
        $bill = $this->ap->postDocument($this->find($request, $uuid), $this->actorId($request));

        return response()->json(['data' => $this->payload($bill->load('lines'), true)]);
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private function find(Request $request, string $uuid): SupplierBill
    {
        return SupplierBill::query()
            ->where('company_id', $this->companyId($request))
            ->where('uuid', $uuid)
            ->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function payload(SupplierBill $b, bool $withLines = false): array
    {
        return [
            'id' => $b->uuid,
            'supplier_id' => $b->supplier_id,
            'document_type' => $b->document_type->value,
            'number' => $b->number,
            'bill_date' => $b->bill_date?->toDateString(),
            'due_date' => $b->due_date?->toDateString(),
            'currency' => $b->currency,
            'subtotal' => (float) $b->subtotal,
            'tax_total' => (float) $b->tax_total,
            'total' => (float) $b->total,
            'status' => $b->status->value,
            'outstanding' => $b->isPosted() ? $b->outstanding() : null,
            'journal_entry_id' => $b->journal_entry_id,
            'posted_at' => $b->posted_at?->toIso8601String(),
            'lines' => $withLines && $b->relationLoaded('lines') ? $b->lines->map(fn ($l) => [
                'expense_account_id' => $l->expense_account_id,
                'description' => $l->description,
                'quantity' => (float) $l->quantity,
                'unit_price' => (float) $l->unit_price,
                'net_amount' => (float) $l->net_amount,
                'tax_code_id' => $l->tax_code_id,
                'tax_amount' => (float) $l->tax_amount,
                'cost_center_id' => $l->cost_center_id,
                'branch_id' => $l->branch_id,
            ])->all() : null,
        ];
    }
}
