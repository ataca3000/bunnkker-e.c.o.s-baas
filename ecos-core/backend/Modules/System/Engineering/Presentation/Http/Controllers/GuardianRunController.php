<?php

namespace Modules\System\Engineering\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Core\Http\Traits\HasApiResponse;
use Modules\System\Engineering\Application\Services\GuardianEngine;
use RuntimeException;

class GuardianRunController
{
    use HasApiResponse;

    public function __construct(
        private readonly GuardianEngine $engine,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        return $this->success($this->engine->list(
            $companyId,
            $request->only(['status', 'decision', 'trigger_source', 'branch', 'per_page']),
        ));
    }

    public function evaluate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'trigger_source'  => 'nullable|in:pre_commit,pipeline,manual,api',
            'commit_ref'      => 'nullable|string|max:64',
            'branch'          => 'nullable|string|max:255',
            'changed_files'   => 'required|array|min:1',
            'changed_files.*' => 'string',
            'diff_content'    => 'required|string',
            'pipeline_run_id' => 'nullable|uuid',
        ]);

        $companyId = auth()->user()->company_id;

        $run = $this->engine->evaluate($companyId, $data, auth()->id());

        return $this->success([
            'run'      => $run->load('checks'),
            'decision' => $run->decision,
            'allowed'  => $run->decision?->allowsCommit() ?? false,
        ], 201);
    }

    public function show(string $id): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        return $this->success($this->engine->get($id, $companyId));
    }

    public function checks(string $id): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        $run = $this->engine->get($id, $companyId);

        return $this->success($run->checks);
    }

    public function decision(string $id): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        $run = $this->engine->get($id, $companyId);

        return $this->success([
            'decision'          => $run->decision,
            'reason'            => $run->decision_reason,
            'status'            => $run->status,
            'allowed'           => $run->decision?->allowsCommit() ?? false,
            'repair_session_id' => $run->repair_session_id,
        ]);
    }

    public function report(string $id): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        $run = $this->engine->get($id, $companyId);

        abort_if(! $run->report, 404, 'Report not generated yet');

        return $this->success($run->report);
    }

    public function revalidate(string $id): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        $run = $this->engine->get($id, $companyId);

        try {
            $run = $this->engine->revalidateAndDecide($run, auth()->id());
        } catch (RuntimeException $e) {
            return $this->error($e->getMessage(), 422);
        }

        return $this->success($run->load(['checks', 'report']));
    }

    public function cancel(string $id): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        $run = $this->engine->get($id, $companyId);

        try {
            $this->engine->cancel($run, auth()->id());
        } catch (RuntimeException $e) {
            return $this->error($e->getMessage(), 422);
        }

        return $this->success($run->fresh());
    }
}
