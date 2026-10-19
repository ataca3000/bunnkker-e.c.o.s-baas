<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Logistics\Operations\Domain\Services\EnterpriseSummaryService;

/**
 * The enterprise summaries — read-only digests over existing monitoring.
 */
class SummaryController extends Controller
{
    public function __construct(
        private readonly EnterpriseSummaryService $summaries,
    ) {}

    public function executive(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->summaries->executive($this->companyId($request))]);
    }

    public function today(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->summaries->today($this->companyId($request))]);
    }

    public function capacity(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->summaries->capacity($this->companyId($request))]);
    }

    public function dispatch(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->summaries->dispatch($this->companyId($request))]);
    }

    public function fleet(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->summaries->fleet($this->companyId($request))]);
    }

    public function exceptions(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->summaries->exceptions($this->companyId($request))]);
    }

    private function companyId(Request $request): ?string
    {
        $companyId = $request->user()?->company_id;

        return $companyId === null ? null : (string) $companyId;
    }
}
