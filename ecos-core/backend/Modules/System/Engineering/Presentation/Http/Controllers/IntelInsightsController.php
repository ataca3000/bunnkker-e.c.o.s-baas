<?php

namespace Modules\System\Engineering\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Core\Http\Traits\HasApiResponse;
use Modules\System\Engineering\Application\Services\IntelInsightsEngine;
use Modules\System\Engineering\Application\Services\IntelPredictionEngine;
use Modules\System\Engineering\Domain\Models\IntelInsight;

class IntelInsightsController
{
    use HasApiResponse;

    public function __construct(
        private readonly IntelInsightsEngine $insights,
        private readonly IntelPredictionEngine $predictions,
    ) {}

    public function index(Request $request): JsonResponse
    {
        return $this->success($this->insights->list(
            auth()->user()->company_id,
            $request->boolean('include_acknowledged'),
        ));
    }

    public function generate(): JsonResponse
    {
        return $this->success($this->insights->generate(auth()->user()->company_id), 201);
    }

    public function acknowledge(string $id): JsonResponse
    {
        $insight = IntelInsight::query()
            ->where('company_id', auth()->user()->company_id)
            ->findOrFail($id);

        return $this->success($this->insights->acknowledge($insight, auth()->id()));
    }

    public function predictions(Request $request): JsonResponse
    {
        $days = (int) $request->query('days', '90');

        return $this->success($this->predictions->predictRisks(auth()->user()->company_id, max(7, min(365, $days))));
    }
}
