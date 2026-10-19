<?php

namespace Modules\System\Engineering\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Core\Http\Traits\HasApiResponse;
use Modules\System\Engineering\Domain\Models\RepairSession;

class RepairResponseController
{
    use HasApiResponse;

    public function forSession(string $id): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        $session = RepairSession::where('company_id', $companyId)->findOrFail($id);

        return $this->success(
            $session->responses()->orderByDesc('received_at')->get(),
        );
    }

    public function review(Request $request, string $id, string $responseId): JsonResponse
    {
        $data = $request->validate([
            'decision' => 'required|in:accepted,rejected,modified',
        ]);

        $companyId = auth()->user()->company_id;

        $session = RepairSession::where('company_id', $companyId)->findOrFail($id);

        $response = $session->responses()->findOrFail($responseId);

        $response->update([
            'review_decision' => $data['decision'],
            'reviewed_by'     => auth()->id(),
            'reviewed_at'     => now(),
            'requires_review' => false,
        ]);

        return $this->success($response->fresh());
    }
}
