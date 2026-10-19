<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Modules\Marketing\CampaignStudio\Application\Actions\ValidateCampaignAction;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignDraft;
use Modules\Marketing\CampaignStudio\Presentation\Http\Resources\ValidationResultResource;

class ValidationController extends Controller
{
    public function __construct(private readonly ValidateCampaignAction $validateAction) {}

    /** POST /mkt/studio/drafts/{draft}/validate */
    public function validate(CampaignDraft $draft): JsonResponse
    {
        $result = $this->validateAction->execute($draft);

        return response()->json([
            'data' => [
                'can_publish' => $result['can_publish'],
                'total_issues' => $result['total_issues'],
                'blocking_errors' => $result['blocking_errors'],
                'warnings' => $result['warnings'],
                'results' => ValidationResultResource::collection(
                    $draft->validationResults()->where('is_resolved', false)->get(),
                )->resolve(),
            ],
        ]);
    }

    /** GET /mkt/studio/drafts/{draft}/validation-results */
    public function results(CampaignDraft $draft): JsonResponse
    {
        $results = $draft->validationResults()->where('is_resolved', false)->get();

        return response()->json([
            'data' => ValidationResultResource::collection($results)->resolve(),
            'can_publish' => ! $results->where('severity.value', 'blocking')->count(),
            'blocking_count' => $results->where('severity', 'blocking')->count(),
            'warning_count' => $results->where('severity', 'warning')->count(),
        ]);
    }
}
