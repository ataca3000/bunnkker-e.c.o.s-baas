<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\CampaignStudio\Application\Services\BulkOperationService;
use Modules\Marketing\CampaignStudio\Domain\Enums\BulkOperationType;

class BulkOperationController extends Controller
{
    public function __construct(private readonly BulkOperationService $bulkService) {}

    /** POST /mkt/studio/bulk */
    public function execute(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'operation' => ['required', 'string', 'in:publish,pause,resume,archive,duplicate,assign_initiative,assign_owner,assign_tags,validate,schedule'],
            'draft_ids' => ['required', 'array', 'min:1', 'max:100'],
            'draft_ids.*' => ['required', 'uuid'],
            'payload' => ['nullable', 'array'],
            'payload.initiative_id' => ['nullable', 'uuid'],
            'payload.owner_id' => ['nullable', 'string'],
            'payload.tags' => ['nullable', 'array'],
            'payload.scheduled_at' => ['nullable', 'date'],
        ]);

        $operationType = BulkOperationType::from($validated['operation']);

        $job = $this->bulkService->queue(
            $operationType,
            $validated['draft_ids'],
            (string) $request->user()->id,
            $request->input('company_id'),
            $validated['payload'] ?? [],
        );

        return response()->json([
            'data' => $job,
            'message' => "Bulk {$operationType->value} queued for {$job->total_count} campaigns.",
        ], 202);
    }

    /** GET /mkt/studio/bulk/{job} */
    public function status(string $job): JsonResponse
    {
        $bulkJob = \Modules\Marketing\CampaignStudio\Domain\Models\CampaignBulkJob::findOrFail($job);

        return response()->json(['data' => $bulkJob]);
    }
}
