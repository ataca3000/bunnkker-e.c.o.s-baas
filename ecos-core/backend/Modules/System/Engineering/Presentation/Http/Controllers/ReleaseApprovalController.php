<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Presentation\Http\Controllers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\System\Engineering\Application\Services\ReleaseApprovalService;
use Modules\System\Engineering\Domain\Models\EngineeringRelease;
use Modules\System\Engineering\Domain\Models\EngineeringReleaseApproval;
use Modules\System\Traits\HasApiResponse;
final class ReleaseApprovalController
{
    use HasApiResponse;
    public function __construct(private readonly ReleaseApprovalService $service) {}

    public function initiate(EngineeringRelease $release): JsonResponse
    {
        abort_if($release->company_id !== auth()->user()->company_id, 403);
        $approvals = $this->service->initializeApprovalWorkflow($release);
        return $this->success(['approvals' => $approvals, 'count' => count($approvals)]);
    }

    public function decide(Request $request, EngineeringRelease $release, EngineeringReleaseApproval $approval): JsonResponse
    {
        abort_if($release->company_id !== auth()->user()->company_id, 403);
        abort_if($approval->release_id !== $release->id, 404);
        $data = $request->validate(['decision' => 'required|string|in:approved,rejected', 'comment' => 'nullable|string|max:1000']);
        return $this->success(['approval' => $this->service->decide($approval, $data['decision'], auth()->id(), $data['comment'] ?? '')]);
    }

    public function skip(Request $request, EngineeringRelease $release, EngineeringReleaseApproval $approval): JsonResponse
    {
        abort_if($release->company_id !== auth()->user()->company_id, 403);
        $data = $request->validate(['reason' => 'nullable|string|max:500']);
        $this->service->skip($approval, auth()->id(), $data['reason'] ?? '');
        return $this->success(['message' => 'Approval skipped']);
    }

    public function status(EngineeringRelease $release): JsonResponse
    {
        abort_if($release->company_id !== auth()->user()->company_id, 403);
        return $this->success($this->service->getWorkflowStatus($release));
    }
}
