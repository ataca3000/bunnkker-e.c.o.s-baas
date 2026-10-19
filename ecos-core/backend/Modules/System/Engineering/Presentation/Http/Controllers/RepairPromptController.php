<?php

namespace Modules\System\Engineering\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Modules\Core\Http\Traits\HasApiResponse;
use Modules\System\Engineering\Domain\Models\RepairSession;
use Modules\System\Engineering\Application\Services\ClaudeCodeIntegration;

class RepairPromptController
{
    use HasApiResponse;

    public function forSession(string $id): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        $session = RepairSession::where('company_id', $companyId)->findOrFail($id);

        return $this->success(
            $session->prompts()->orderByDesc('created_at')->get(),
        );
    }

    public function active(string $id): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        $session = RepairSession::where('company_id', $companyId)->findOrFail($id);

        $prompt = $session->activePrompt;

        abort_if($prompt === null, 404, 'No active prompt found');

        return $this->success($prompt);
    }

    public function markSent(string $id, string $promptId): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        $session = RepairSession::where('company_id', $companyId)->findOrFail($id);

        $prompt = $session->prompts()->findOrFail($promptId);

        app(ClaudeCodeIntegration::class)->markSent($prompt);

        return $this->success($prompt->fresh());
    }
}
