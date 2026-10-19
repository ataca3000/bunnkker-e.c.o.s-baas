<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Presentation\Http\Controllers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Core\Traits\HasApiResponse;
use Modules\System\Engineering\Application\Services\AIRiskEngine;
use Modules\System\Engineering\Domain\Models\EngineeringAIReview;
use Modules\System\Engineering\Domain\Models\EngineeringAIRisk;

class AIRiskController extends Controller
{
    use HasApiResponse;
    public function __construct(private readonly AIRiskEngine $riskEngine) {}

    public function forReview(string $reviewId): JsonResponse
    {
        $review = EngineeringAIReview::findOrFail($reviewId);
        abort_if($review->company_id !== auth()->user()->company_id, 403);
        return $this->success(['risks' => $review->risks()->orderBy('priority')->get()]);
    }

    public function show(string $reviewId, string $riskId): JsonResponse
    {
        $review = EngineeringAIReview::findOrFail($reviewId);
        abort_if($review->company_id !== auth()->user()->company_id, 403);
        $risk = EngineeringAIRisk::where('review_id', $reviewId)->findOrFail($riskId);
        return $this->success(['risk' => $risk]);
    }

    public function acknowledge(string $reviewId, string $riskId): JsonResponse
    {
        $review = EngineeringAIReview::findOrFail($reviewId);
        abort_if($review->company_id !== auth()->user()->company_id, 403);
        $risk = EngineeringAIRisk::where('review_id', $reviewId)->findOrFail($riskId);
        $this->riskEngine->acknowledgeRisk($risk, auth()->id());
        return $this->success(['risk' => $risk->fresh()]);
    }
}
