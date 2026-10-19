<?php

namespace Modules\System\Engineering\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Core\Http\Traits\HasApiResponse;
use Modules\System\Engineering\Domain\Models\RepairSession;
use Modules\System\Engineering\Application\Services\ClaudeCodeIntegration;
use Modules\System\Engineering\Application\Services\RepairEngine;
use Modules\System\Engineering\Application\Services\RepairSessionManager;

class RepairSessionController
{
    use HasApiResponse;

    public function __construct(
        private readonly RepairEngine $engine,
        private readonly RepairSessionManager $manager,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        $sessions = $this->manager->list(
            $companyId,
            $request->only(['status', 'failure_type', 'search', 'per_page']),
        );

        return $this->success($sessions);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'source_type'     => 'required|in:pipeline,validation,supervisor,manual,test',
            'source_id'       => 'nullable|uuid',
            'failure_type'    => 'required|string',
            'failure_summary' => 'required|string|max:1000',
            'failure_context' => 'nullable|array',
        ]);

        $companyId = auth()->user()->company_id;

        $session = $this->engine->initiate(
            $companyId,
            $data['source_type'],
            $data['source_id'] ?? null,
            $data['failure_type'],
            $data['failure_summary'],
            $data['failure_context'] ?? null,
        );

        return $this->success($session, 201);
    }

    public function show(string $id): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        $session = $this->manager->get($id, $companyId);

        return $this->success($session);
    }

    public function destroy(string $id): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        $session = RepairSession::where('company_id', $companyId)->findOrFail($id);

        $this->manager->delete($session);

        return $this->success(['deleted' => true]);
    }

    public function analyze(string $id): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        $session = RepairSession::where('company_id', $companyId)->findOrFail($id);

        abort_if($session->isTerminal(), 422, 'Session is terminal');

        $this->engine->analyze($session);

        return $this->success($session->load('analysis'));
    }

    public function generatePrompt(string $id): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        $session = RepairSession::where('company_id', $companyId)
            ->with('analysis')
            ->findOrFail($id);

        $package = $this->engine->generatePrompt($session);

        return $this->success($package);
    }

    public function getPromptPackage(string $id): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        $session = RepairSession::where('company_id', $companyId)->findOrFail($id);

        $prompt = $session->activePrompt;

        abort_if($prompt === null, 404, 'No active prompt found');

        $package = app(ClaudeCodeIntegration::class)->prepareClaudePackage($session, $prompt);

        return $this->success($package);
    }

    public function submitResponse(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'response_content' => 'required|string',
            'response_type'    => 'required|in:patch,explanation,clarification_request,error,timeout',
        ]);

        $companyId = auth()->user()->company_id;

        $session = RepairSession::where('company_id', $companyId)
            ->with('activePrompt')
            ->findOrFail($id);

        $this->engine->submitResponse(
            $session,
            $data['response_content'],
            $data['response_type'],
            auth()->id(),
        );

        return $this->success($session->load(['responses', 'patches']));
    }

    public function applyPatch(string $id, string $patchId): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        $session = RepairSession::where('company_id', $companyId)->findOrFail($id);

        $this->engine->applyPatch($session, $patchId, auth()->id());

        return $this->success($session->load('patches'));
    }

    public function complete(string $id): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        $session = RepairSession::where('company_id', $companyId)->findOrFail($id);

        $this->engine->complete($session, auth()->id());

        return $this->success($session);
    }

    public function fail(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'reason' => 'required|string|max:500',
        ]);

        $companyId = auth()->user()->company_id;

        $session = RepairSession::where('company_id', $companyId)->findOrFail($id);

        $this->engine->fail($session, $data['reason'], auth()->id());

        return $this->success($session);
    }

    public function cancel(string $id): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        $session = RepairSession::where('company_id', $companyId)->findOrFail($id);

        $this->engine->cancel($session, auth()->id());

        return $this->success($session);
    }

    public function retry(string $id): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        $session = RepairSession::where('company_id', $companyId)->findOrFail($id);

        $retried = $this->engine->retry($session);

        return $this->success([
            'retried'     => $retried,
            'retry_count' => $session->fresh()->retry_count,
        ]);
    }

    public function history(string $id): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        $session = RepairSession::where('company_id', $companyId)->findOrFail($id);

        return $this->success($session->history()->get());
    }
}
