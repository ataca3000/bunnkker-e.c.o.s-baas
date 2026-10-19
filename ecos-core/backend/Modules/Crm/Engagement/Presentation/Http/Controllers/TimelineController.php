<?php

declare(strict_types=1);

namespace Modules\Crm\Engagement\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Crm\Customers\Presentation\Http\Controllers\Concerns\ResolvesCustomerContext;
use Modules\Crm\Engagement\Domain\Services\CustomerJourneyService;
use Modules\Crm\Engagement\Domain\Services\TimelineService;

/**
 * The customer timeline, interaction history, omnichannel feed and journey —
 * read-only aggregations across CRM activities and existing systems.
 */
class TimelineController extends Controller
{
    use ResolvesCustomerContext;

    public function __construct(
        private readonly TimelineService $timeline,
        private readonly CustomerJourneyService $journey,
    ) {}

    public function timeline(Request $request, string $id): JsonResponse
    {
        $customer = $this->customer($request, $id);

        return response()->json(['data' => $this->timeline->timeline(
            $this->companyId($request), (string) $customer->id, $this->filters($request),
        )]);
    }

    public function interactions(Request $request, string $id): JsonResponse
    {
        $customer = $this->customer($request, $id);

        return response()->json(['data' => $this->timeline->interactions(
            $this->companyId($request), (string) $customer->id, $this->filters($request),
        )]);
    }

    public function feed(Request $request, string $id): JsonResponse
    {
        $customer = $this->customer($request, $id);

        return response()->json(['data' => $this->timeline->feed(
            $this->companyId($request), (string) $customer->id, $this->filters($request),
        )]);
    }

    public function journey(Request $request, string $id): JsonResponse
    {
        $customer = $this->customer($request, $id);

        return response()->json(['data' => $this->journey->journey($this->companyId($request), (string) $customer->id)]);
    }

    /** @return array<string, mixed> */
    private function filters(Request $request): array
    {
        return $request->only(['from', 'to', 'type', 'source', 'channel', 'limit', 'offset']);
    }
}
