<?php

declare(strict_types=1);

namespace Modules\Crm\Intelligence\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Crm\Customers\Presentation\Http\Controllers\Concerns\ResolvesCustomerContext;
use Modules\Crm\Intelligence\Domain\Models\CustomerInsight;
use Modules\Crm\Intelligence\Domain\Models\CustomerIntelligenceProfile;
use Modules\Crm\Intelligence\Domain\Models\CustomerRecommendation;
use Modules\Crm\Intelligence\Domain\Services\CustomerIntelligenceService;

/** The customer intelligence profile — RFM, value, churn, health and insights. */
class CustomerIntelligenceController extends Controller
{
    use ResolvesCustomerContext;

    public function __construct(private readonly CustomerIntelligenceService $intelligence) {}

    public function index(Request $request): JsonResponse
    {
        $rows = CustomerIntelligenceProfile::query()
            ->where('company_id', $this->companyId($request))
            ->when($request->filled('segment'), fn ($q) => $q->where('rfm_segment', $request->string('segment')))
            ->when($request->filled('churn_band'), fn ($q) => $q->where('churn_risk_band', $request->string('churn_band')))
            ->when($request->filled('health_band'), fn ($q) => $q->where('health_band', $request->string('health_band')))
            ->orderByDesc('lifetime_value')
            ->limit(100)->get();

        return response()->json(['data' => $rows]);
    }

    public function show(Request $request, string $customerId): JsonResponse
    {
        $this->customer($request, $customerId);
        $companyId = $this->companyId($request);

        $profile = CustomerIntelligenceProfile::query()
            ->where('company_id', $companyId)->where('customer_id', $customerId)->first();

        return response()->json([
            'data' => [
                'profile' => $profile,
                'insights' => CustomerInsight::query()
                    ->where('company_id', $companyId)->where('customer_id', $customerId)
                    ->orderByDesc('generated_at')->get(),
                'recommendations' => CustomerRecommendation::query()
                    ->where('company_id', $companyId)->where('customer_id', $customerId)
                    ->orderByDesc('priority')->get(),
            ],
        ]);
    }

    public function recompute(Request $request, string $customerId): JsonResponse
    {
        $customer = $this->customer($request, $customerId);
        $profile = $this->intelligence->recomputeCustomer($this->companyId($request), (string) $customer->id);

        return response()->json(['data' => $profile]);
    }

    public function recomputeAll(Request $request): JsonResponse
    {
        $count = $this->intelligence->recomputeCompany($this->companyId($request));

        return response()->json(['data' => ['computed' => $count]]);
    }
}
