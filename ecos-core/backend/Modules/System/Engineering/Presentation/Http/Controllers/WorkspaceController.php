<?php

namespace Modules\System\Engineering\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Modules\Core\Http\Traits\HasApiResponse;
use Modules\System\Engineering\Application\Services\WorkspaceAggregationService;

class WorkspaceController
{
    use HasApiResponse;

    public function __construct(
        private readonly WorkspaceAggregationService $workspace,
    ) {}

    public function executive(): JsonResponse
    {
        return $this->success($this->workspace->executive(auth()->user()->company_id));
    }

    public function live(): JsonResponse
    {
        return $this->success($this->workspace->live(auth()->user()->company_id));
    }

    public function timeline(Request $request): JsonResponse
    {
        $type = $request->query('type');

        abort_unless(
            $type === null || in_array($type, ['repair', 'validation', 'guardian'], true),
            422,
            'type must be repair, validation, or guardian',
        );

        return $this->success($this->workspace->timeline(
            auth()->user()->company_id,
            $type,
            (int) $request->query('limit', '50'),
        ));
    }

    public function search(Request $request): JsonResponse
    {
        $data = $request->validate(['q' => 'required|string|min:2|max:120']);

        return $this->success($this->workspace->search(auth()->user()->company_id, $data['q']));
    }

    public function releaseReadiness(Request $request): JsonResponse
    {
        return $this->success($this->workspace->releaseReadiness(
            auth()->user()->company_id,
            (int) $request->query('limit', '10'),
        ));
    }

    public function export(Request $request): Response
    {
        $data = $request->validate(['dataset' => 'required|in:repair_sessions,validations,guardian_runs']);

        $csv = $this->workspace->exportCsv(auth()->user()->company_id, $data['dataset']);

        return response($csv, 200, [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="engineering-' . $data['dataset'] . '.csv"',
        ]);
    }
}
