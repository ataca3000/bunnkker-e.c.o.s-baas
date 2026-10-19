<?php

declare(strict_types=1);

namespace Modules\Crm\Intelligence\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Crm\Customers\Presentation\Http\Controllers\Concerns\ResolvesCustomerContext;
use Modules\Crm\Intelligence\Domain\Models\CustomerRecommendation;

/** Rule-based recommendations — portfolio queue and per-customer, with status. */
class RecommendationController extends Controller
{
    use ResolvesCustomerContext;

    public function index(Request $request): JsonResponse
    {
        $rows = CustomerRecommendation::query()
            ->where('company_id', $this->companyId($request))
            ->when($request->filled('type'), fn ($q) => $q->where('type', $request->string('type')))
            ->where('status', $request->string('status', 'open'))
            ->orderByDesc('priority')
            ->limit(100)->get();

        return response()->json(['data' => $rows]);
    }

    public function forCustomer(Request $request, string $customerId): JsonResponse
    {
        $this->customer($request, $customerId);

        $rows = CustomerRecommendation::query()
            ->where('company_id', $this->companyId($request))
            ->where('customer_id', $customerId)
            ->orderByDesc('priority')->get();

        return response()->json(['data' => $rows]);
    }

    public function updateStatus(Request $request, string $id): JsonResponse
    {
        $v = $request->validate(['status' => ['required', 'in:open,actioned,dismissed']]);

        $rec = CustomerRecommendation::query()
            ->where('company_id', $this->companyId($request))->where('id', $id)->firstOrFail();
        $rec->update(['status' => $v['status']]);

        return response()->json(['data' => $rec]);
    }
}
