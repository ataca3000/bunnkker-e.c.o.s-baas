<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Modules\Finance\Presentation\Http\Controllers\Concerns\ResolvesFinanceContext;
use Modules\Finance\Receivables\Domain\Enums\CustomerDocumentType;
use Modules\Finance\Receivables\Domain\Models\CustomerInvoice;
use Modules\Finance\Receivables\Domain\Services\AccountsReceivableService;

/**
 * Customer invoices, credit notes and debit notes. Draft → post; a posted
 * document is immutable. Posting requests a journal from the Posting Engine —
 * AR never writes the ledger.
 */
class CustomerInvoiceController extends Controller
{
    use ResolvesFinanceContext;

    public function __construct(private readonly AccountsReceivableService $ar) {}

    public function index(Request $request): JsonResponse
    {
        $docs = CustomerInvoice::query()
            ->where('company_id', $this->companyId($request))
            ->when($request->filled('customer_id'), fn ($q) => $q->where('customer_id', $request->string('customer_id')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->latest('id')
            ->limit(100)
            ->get()
            ->map(fn (CustomerInvoice $i) => $this->payload($i));

        return response()->json(['data' => $docs]);
    }

    public function show(Request $request, string $uuid): JsonResponse
    {
        $invoice = $this->find($request, $uuid)->load('lines');

        return response()->json(['data' => $this->payload($invoice, true)]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => ['required', 'string'],
            'document_type' => ['nullable', Rule::in(['invoice', 'credit_note', 'debit_note'])],
            'number' => ['required', 'string', 'max:60'],
            'document_date' => ['required', 'date'],
            'due_date' => ['nullable', 'date'],
            'currency' => ['nullable', 'string', 'size:3'],
            'description' => ['nullable', 'string', 'max:500'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.revenue_account_id' => ['required', 'string'], // uuid
            'lines.*.description' => ['nullable', 'string', 'max:500'],
            'lines.*.quantity' => ['nullable', 'numeric'],
            'lines.*.unit_price' => ['nullable', 'numeric'],
            'lines.*.net_amount' => ['nullable', 'numeric'],
            'lines.*.tax_code_id' => ['nullable', 'integer'],
            'lines.*.cost_center_id' => ['nullable', 'integer'],
            'lines.*.branch_id' => ['nullable', 'string'],
        ]);

        $lines = $this->resolveLineAccounts($request, $validated['lines'], 'revenue_account_id');

        $invoice = $this->ar->createDocument(
            companyId: $this->companyId($request),
            customerId: $validated['customer_id'],
            number: $validated['number'],
            documentDate: Carbon::parse($validated['document_date']),
            lines: $lines,
            type: CustomerDocumentType::from($validated['document_type'] ?? 'invoice'),
            dueDate: isset($validated['due_date']) ? Carbon::parse($validated['due_date']) : null,
            currency: $validated['currency'] ?? 'EGP',
            description: $validated['description'] ?? null,
            createdBy: $this->actorId($request),
        );

        return response()->json(['data' => $this->payload($invoice->load('lines'), true)], 201);
    }

    public function post(Request $request, string $uuid): JsonResponse
    {
        $invoice = $this->ar->postDocument($this->find($request, $uuid), $this->actorId($request));

        return response()->json(['data' => $this->payload($invoice->load('lines'), true)]);
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private function find(Request $request, string $uuid): CustomerInvoice
    {
        return CustomerInvoice::query()
            ->where('company_id', $this->companyId($request))
            ->where('uuid', $uuid)
            ->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function payload(CustomerInvoice $i, bool $withLines = false): array
    {
        return [
            'id' => $i->uuid,
            'customer_id' => $i->customer_id,
            'document_type' => $i->document_type->value,
            'number' => $i->number,
            'invoice_date' => $i->invoice_date?->toDateString(),
            'due_date' => $i->due_date?->toDateString(),
            'currency' => $i->currency,
            'subtotal' => (float) $i->subtotal,
            'tax_total' => (float) $i->tax_total,
            'total' => (float) $i->total,
            'status' => $i->status->value,
            'outstanding' => $i->isPosted() ? $i->outstanding() : null,
            'journal_entry_id' => $i->journal_entry_id,
            'posted_at' => $i->posted_at?->toIso8601String(),
            'lines' => $withLines && $i->relationLoaded('lines') ? $i->lines->map(fn ($l) => [
                'revenue_account_id' => $l->revenue_account_id,
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
