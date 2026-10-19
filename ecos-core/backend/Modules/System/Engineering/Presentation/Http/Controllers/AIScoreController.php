<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Presentation\Http\Controllers;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Modules\Core\Traits\HasApiResponse;
use Modules\System\Engineering\Domain\Models\EngineeringAIReview;
use Modules\System\Engineering\Domain\Models\EngineeringAIArchitectureCheck;
use Modules\System\Engineering\Domain\Models\EngineeringAISecurityCheck;

class AIScoreController extends Controller
{
    use HasApiResponse;

    public function forReview(string $reviewId): JsonResponse
    {
        $review = EngineeringAIReview::findOrFail($reviewId);
        abort_if($review->company_id !== auth()->user()->company_id, 403);
        return $this->success(['scores' => $review->scores()->get()]);
    }

    public function architectureChecks(string $reviewId): JsonResponse
    {
        $review = EngineeringAIReview::findOrFail($reviewId);
        abort_if($review->company_id !== auth()->user()->company_id, 403);
        $checks = EngineeringAIArchitectureCheck::where('review_id', $reviewId)->get();
        return $this->success(['checks' => $checks, 'summary' => [
            'total'  => $checks->count(),
            'passed' => $checks->where('passed', true)->count(),
            'failed' => $checks->where('passed', false)->count(),
        ]]);
    }

    public function securityChecks(string $reviewId): JsonResponse
    {
        $review = EngineeringAIReview::findOrFail($reviewId);
        abort_if($review->company_id !== auth()->user()->company_id, 403);
        $checks = EngineeringAISecurityCheck::where('review_id', $reviewId)->get();
        return $this->success(['checks' => $checks, 'summary' => [
            'total'  => $checks->count(),
            'passed' => $checks->where('passed', true)->count(),
            'failed' => $checks->where('passed', false)->count(),
        ]]);
    }
}
