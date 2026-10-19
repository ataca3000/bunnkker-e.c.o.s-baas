<?php

declare(strict_types=1);

namespace Modules\Crm\Sales\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Crm\Customers\Presentation\Http\Controllers\Concerns\ResolvesCustomerContext;
use Modules\Crm\Sales\Domain\Models\Quote;
use Modules\Crm\Sales\Domain\Services\QuoteService;

/** Quotes — proposals built from lines; products referenced by opaque id. */
class QuoteController extends Controller
{
    use ResolvesCustomerContext;

    public function __construct(private readonly QuoteService $quotes) {}

    public function index(Request $request): JsonResponse
    {
        $rows = Quote::query()
            ->where('company_id', $this->companyId($request))
            ->when($request->filled('customer_id'), fn ($q) => $q->where('customer_id', $request->string('customer_id')))
            ->latest('created_at')->limit(100)->get()
            ->map(fn (Quote $q) => $this->payload($q));

        return response()->json(['data' => $rows]);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $quote = $this->quote($request, $id)->load('lines');

        return response()->json(['data' => $this->payload($quote, true)]);
    }

    public function store(Request $request): JsonResponse
    {
        $v = $request->validate([
            'customer_id' => ['nullable', 'string'],
            'opportunity_id' => ['nullable', 'string'],
            'currency' => ['nullable', 'string', 'size:3'],
            'discount' => ['nullable', 'numeric'],
            'tax' => ['nullable', 'numeric'],
            'valid_until' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.description' => ['required', 'string', 'max:300'],
            'lines.*.product_reference' => ['nullable', 'string', 'max:64'],
            'lines.*.quantity' => ['nullable', 'numeric'],
            'lines.*.unit_price' => ['nullable', 'numeric'],
            'lines.*.discount' => ['nullable', 'numeric'],
        ]);

        $quote = $this->quotes->create($this->companyId($request), $v, $v['lines'], $this->actorId($request));

        return response()->json(['data' => $this->payload($quote->load('lines'), true)], 201);
    }

    public function send(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => $this->payload($this->quotes->send($this->quote($request, $id)))]);
    }

    public function accept(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => $this->payload($this->quotes->accept($this->quote($request, $id)))]);
    }

    public function reject(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => $this->payload($this->quotes->reject($this->quote($request, $id)))]);
    }

    private function quote(Request $request, string $id): Quote
    {
        return Quote::query()->where('company_id', $this->companyId($request))->where('id', $id)->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function payload(Quote $q, bool $withLines = false): array
    {
        return [
            'id' => $q->id, 'quote_number' => $q->quote_number, 'customer_id' => $q->customer_id, 'opportunity_id' => $q->opportunity_id,
            'status' => $q->status->value, 'currency' => $q->currency, 'subtotal' => (float) $q->subtotal,
            'discount' => (float) $q->discount, 'tax' => (float) $q->tax, 'total' => (float) $q->total,
            'valid_until' => $q->valid_until?->toDateString(),
            'lines' => $withLines && $q->relationLoaded('lines') ? $q->lines->map(fn ($l) => [
                'description' => $l->description, 'product_reference' => $l->product_reference,
                'quantity' => (float) $l->quantity, 'unit_price' => (float) $l->unit_price, 'discount' => (float) $l->discount, 'line_total' => (float) $l->line_total,
            ])->all() : null,
        ];
    }
}
