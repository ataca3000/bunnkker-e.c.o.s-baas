<?php

declare(strict_types=1);

namespace Modules\Crm\Intelligence\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Crm\Customers\Presentation\Http\Controllers\Concerns\ResolvesCustomerContext;
use Modules\Crm\Intelligence\Domain\Services\SegmentationService;

/** Segment definitions and the portfolio distribution across segments. */
class SegmentationController extends Controller
{
    use ResolvesCustomerContext;

    public function __construct(private readonly SegmentationService $segmentation) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->segmentation->catalog($this->companyId($request))]);
    }

    public function distribution(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->segmentation->distribution($this->companyId($request))]);
    }
}
