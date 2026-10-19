<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Presentation\Http\Controllers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Core\Traits\HasApiResponse;
use Modules\System\Engineering\Application\Services\AIReviewEngine;
use Modules\System\Engineering\Application\Services\AIReleaseRecommendationEngine;
use Modules\System\Engineering\Domain\Models\EngineeringRelease;
use Modules\System\Engineering\Domain\Models\EngineeringAIReleaseReview;

class AIReleaseReviewController extends Controller
{
    use HasApiResponse;
    public function __construct(
        private readonly AIReviewEngine                 $reviewEngine,
        private readonly AIReleaseRecommendationEngine  $releaseRecEngine,
    ) {}

    public function trigger(string $releaseId): JsonResponse
    {
        $release = EngineeringRelease::findOrFail($releaseId);
        abort_if($release->company_id !== auth()->user()->company_id, 403);

        // Create and run a new review linked to this release
        $review  = $this->reviewEngine->create(
            auth()->user()->company_id,
            'release',
            'release',
            $releaseId,
            auth()->id(),
        );
        $result  = $this->reviewEngine->run($review);
        $relReview = $this->releaseRecEngine->generateReleaseReview($result, $releaseId);

        return $this->success([
            'review'          => $result,
            'release_review'  => $relReview,
        ], 201);
    }

    public function show(string $releaseId): JsonResponse
    {
        $release = EngineeringRelease::findOrFail($releaseId);
        abort_if($release->company_id !== auth()->user()->company_id, 403);
        $relReview = EngineeringAIReleaseReview::where('release_id', $releaseId)
            ->with('review')->latest()->first();
        return $this->success(['release_review' => $relReview]);
    }

    public function recommendation(string $releaseId): JsonResponse
    {
        $release   = EngineeringRelease::findOrFail($releaseId);
        abort_if($release->company_id !== auth()->user()->company_id, 403);
        $relReview = EngineeringAIReleaseReview::where('release_id', $releaseId)->latest()->first();
        if (!$relReview) {
            return $this->success(['recommendation' => null, 'message' => 'No AI review has been run for this release.']);
        }
        return $this->success([
            'recommendation'       => $relReview->recommendation?->value,
            'justification'        => $relReview->justification,
            'is_blocking'          => $relReview->is_blocking,
            'score_at_review'      => $relReview->score_at_review,
            'blocking_risks_count' => $relReview->blocking_risks_count,
        ]);
    }
}
