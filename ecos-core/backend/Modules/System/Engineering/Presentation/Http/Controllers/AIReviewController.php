<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Core\Traits\HasApiResponse;
use Modules\System\Engineering\Application\Services\AIReviewEngine;
use Modules\System\Engineering\Domain\Models\EngineeringAIReview;

class AIReviewController extends Controller
{
    use HasApiResponse;

    public function __construct(private readonly AIReviewEngine $reviewEngine) {}

    public function index(Request $request): JsonResponse
    {
        $reviews = $this->reviewEngine->listReviews(
            auth()->user()->company_id,
            $request->only(['status', 'review_type', 'recommendation', 'per_page'])
        );
        return $this->success([
            'data' => $reviews->items(),
            'meta' => [
                'page'     => $reviews->currentPage(),
                'perPage'  => $reviews->perPage(),
                'total'    => $reviews->total(),
                'lastPage' => $reviews->lastPage(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data   = $request->validate([
            'review_type'  => 'sometimes|string|in:task,release,codebase,scheduled,manual',
            'subject_type' => 'sometimes|nullable|string',
            'subject_id'   => 'sometimes|nullable|uuid',
        ]);
        $review = $this->reviewEngine->create(
            auth()->user()->company_id,
            $data['review_type'] ?? 'manual',
            $data['subject_type'] ?? null,
            $data['subject_id'] ?? null,
            auth()->id(),
        );
        return $this->success(['review' => $review], 201);
    }

    public function show(string $id): JsonResponse
    {
        $review = EngineeringAIReview::with(['scores', 'risks', 'recommendations', 'architectureChecks', 'securityChecks'])
            ->findOrFail($id);
        abort_if($review->company_id !== auth()->user()->company_id, 403);
        return $this->success(['review' => $review]);
    }

    public function destroy(string $id): JsonResponse
    {
        $review = EngineeringAIReview::findOrFail($id);
        abort_if($review->company_id !== auth()->user()->company_id, 403);
        $review->delete();
        return $this->success(['message' => 'Review deleted.']);
    }

    public function run(string $id): JsonResponse
    {
        $review = EngineeringAIReview::findOrFail($id);
        abort_if($review->company_id !== auth()->user()->company_id, 403);
        $result = $this->reviewEngine->run($review);
        return $this->success(['review' => $result]);
    }

    public function cancel(string $id): JsonResponse
    {
        $review = EngineeringAIReview::findOrFail($id);
        abort_if($review->company_id !== auth()->user()->company_id, 403);
        $this->reviewEngine->cancel($review);
        return $this->success(['review' => $review->fresh()]);
    }

    public function results(string $id): JsonResponse
    {
        $review = EngineeringAIReview::findOrFail($id);
        abort_if($review->company_id !== auth()->user()->company_id, 403);
        return $this->success($this->reviewEngine->getResults($review));
    }

    public function dashboard(): JsonResponse
    {
        return $this->success($this->reviewEngine->getDashboard(auth()->user()->company_id));
    }
}
