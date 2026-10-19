<?php

namespace Modules\System\Engineering\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Core\Http\Traits\HasApiResponse;
use Modules\System\Engineering\Application\Services\IntelConfidenceScorer;
use Modules\System\Engineering\Application\Services\IntelKnowledgeBase;
use Modules\System\Engineering\Application\Services\IntelLearningEngine;
use Modules\System\Engineering\Application\Services\IntelPatternDetector;

class IntelKnowledgeController
{
    use HasApiResponse;

    public function __construct(
        private readonly IntelKnowledgeBase $knowledgeBase,
        private readonly IntelLearningEngine $learningEngine,
        private readonly IntelPatternDetector $patternDetector,
        private readonly IntelConfidenceScorer $scorer,
    ) {}

    public function index(Request $request): JsonResponse
    {
        return $this->success($this->knowledgeBase->list(
            auth()->user()->company_id,
            $request->query('category'),
        ));
    }

    public function learn(): JsonResponse
    {
        $result = $this->learningEngine->learn(auth()->user()->company_id);

        return $this->success(['learned' => $result], 201);
    }

    public function patterns(Request $request): JsonResponse
    {
        $days = (int) $request->query('days', '90');

        return $this->success($this->patternDetector->detect(auth()->user()->company_id, max(1, min(365, $days))));
    }

    public function recommendations(Request $request): JsonResponse
    {
        $data = $request->validate([
            'failure_type' => 'required|string|max:64',
            'root_cause'   => 'nullable|string|max:128',
        ]);

        return $this->success($this->knowledgeBase->recommendForFailure(
            auth()->user()->company_id,
            $data['failure_type'],
            $data['root_cause'] ?? null,
        ));
    }

    public function confidence(Request $request): JsonResponse
    {
        $data = $request->validate([
            'failure_type' => 'required|string|max:64',
            'root_cause'   => 'nullable|string|max:128',
        ]);

        return $this->success([
            'failure_type'      => $data['failure_type'],
            'root_cause'        => $data['root_cause'] ?? null,
            'repair_confidence' => $this->scorer->repairConfidence(
                auth()->user()->company_id,
                $data['failure_type'],
                $data['root_cause'] ?? null,
            ),
        ]);
    }
}
