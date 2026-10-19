<?php

declare(strict_types=1);

namespace Modules\Crm\Intelligence\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Crm\Customers\Presentation\Http\Controllers\Concerns\ResolvesCustomerContext;
use Modules\Crm\Intelligence\Domain\Models\PurchaseFact;
use Modules\Crm\Intelligence\Domain\Services\PurchaseFactService;

/** Ingest purchase facts by opaque reference — the deterministic data source. */
class PurchaseFactController extends Controller
{
    use ResolvesCustomerContext;

    public function __construct(private readonly PurchaseFactService $facts) {}

    public function index(Request $request, string $customerId): JsonResponse
    {
        $this->customer($request, $customerId);   // scope + 404 guard

        return response()->json(['data' => $this->facts->factsFor($customerId)]);
    }

    public function store(Request $request): JsonResponse
    {
        $v = $request->validate([
            'customer_id' => ['required', 'string'],
            'source_reference' => ['required', 'string', 'max:64'],
            'source_type' => ['nullable', 'string', 'max:40'],
            'channel' => ['nullable', 'string', 'max:40'],
            'amount' => ['required', 'numeric', 'min:0'],
            'item_count' => ['nullable', 'integer', 'min:0'],
            'occurred_at' => ['nullable', 'date'],
        ]);

        $customer = $this->customer($request, $v['customer_id']);
        $fact = $this->facts->record($this->companyId($request), (string) $customer->id, [
            ...$v,
            'actor_id' => $this->actorId($request),
        ]);

        return response()->json(['data' => $fact], 201);
    }
}
