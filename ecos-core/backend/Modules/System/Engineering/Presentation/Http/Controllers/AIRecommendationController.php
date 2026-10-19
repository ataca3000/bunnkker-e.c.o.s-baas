<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Presentation\Http\Controllers;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Modules\Core\Traits\HasApiResponse;
use Modules\System\Engineering\Application\Services\AIRecommendationEngine;
use Modules\System\Engineering\Domain\Models\EngineeringAIReview;
use Modules\System\Engineering\Domain\Models\EngineeringAIRecommendation;

class AIRecommendationController extends Controller
{
    use HasApiResponse;
    public function __construct(private readonly AIRecommendationEngine $recEngine) {}

    public function forReview(string $reviewId): JsonResponse
    {
        $review = EngineeringAIReview::findOrFail($reviewId);
        abort_if($review->company_id !== auth()->user()->company_id, 403);
        return $this->success(['recommendations' => $review->recommendations()->get()]);
    }

    public function resolve(string $reviewId, string $recId): JsonResponse
    {
        $review = EngineeringAIReview::findOrFail($reviewId);
        abort_if($review->company_id !== auth()->user()->company_id, 403);
        $rec = EngineeringAIRecommendation::where('review_id', $reviewId)->findOrFail($recId);
        $this->recEngine->resolve($rec, auth()->id());
        return $this->success(['recommendation' => $rec->fresh()]);
    }

    public function openForCompany(): JsonResponse
    {
        $recs = $this->recEngine->getOpenRecommendations(auth()->user()->company_id);
        return $this->success(['recommendations' => $recs]);
    }
}
