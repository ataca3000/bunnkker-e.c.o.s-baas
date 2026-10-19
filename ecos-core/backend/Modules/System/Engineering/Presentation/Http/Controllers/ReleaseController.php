<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Presentation\Http\Controllers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\System\Engineering\Application\Services\ReleaseDependencyService;
use Modules\System\Engineering\Application\Services\ReleaseApprovalService;
use Modules\System\Engineering\Application\Services\ReleaseReadinessScorer;
use Modules\System\Engineering\Application\Services\ReleaseReportService;
use Modules\System\Engineering\Application\Services\ReleaseRiskService;
use Modules\System\Engineering\Application\Services\ReleaseService;
use Modules\System\Engineering\Application\Services\ReleaseValidationService;
use Modules\System\Engineering\Domain\Enums\ReleaseStatus;
use Modules\System\Engineering\Domain\Models\EngineeringRelease;
use Modules\System\Traits\HasApiResponse;

final class ReleaseController
{
    use HasApiResponse;
    public function __construct(
        private readonly ReleaseService $releases,
        private readonly ReleaseValidationService $validation,
        private readonly ReleaseReadinessScorer $scorer,
        private readonly ReleaseRiskService $risks,
        private readonly ReleaseReportService $reports,
        private readonly ReleaseDependencyService $dependencies,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $paginator = $this->releases->list(auth()->user()->company_id, $request->only('status','risk_level','search'), (int)$request->get('page',1), (int)$request->get('per_page',25));
        return $this->success(['data' => $paginator->items(), 'meta' => ['page' => $paginator->currentPage(), 'per_page' => $paginator->perPage(), 'total' => $paginator->total(), 'last_page' => $paginator->lastPage()]]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'               => 'required|string|max:255',
            'version'            => 'nullable|string|max:50',
            'description'        => 'nullable|string',
            'release_type'       => 'nullable|string|in:standard,hotfix,patch,major',
            'task_ids'           => 'nullable|array',
            'task_ids.*'         => 'uuid',
            'target_environment' => 'nullable|string|max:50',
            'scheduled_at'       => 'nullable|date',
            'is_breaking_change' => 'nullable|boolean',
        ]);
        $release = $this->releases->create(auth()->user()->company_id, $data, auth()->id());
        return $this->success(['release' => $release], 201);
    }

    public function show(EngineeringRelease $release): JsonResponse
    {
        abort_if($release->company_id !== auth()->user()->company_id, 403);
        $release->load('artifacts','reports','validations','approvals','risks','dependencies','notes','pipelineRuns');
        return $this->success(['release' => $release]);
    }

    public function update(Request $request, EngineeringRelease $release): JsonResponse
    {
        abort_if($release->company_id !== auth()->user()->company_id, 403);
        $data = $request->validate([
            'name'               => 'sometimes|string|max:255',
            'version'            => 'nullable|string|max:50',
            'description'        => 'nullable|string',
            'task_ids'           => 'nullable|array',
            'task_ids.*'         => 'uuid',
            'target_environment' => 'nullable|string',
            'scheduled_at'       => 'nullable|date',
            'is_breaking_change' => 'nullable|boolean',
        ]);
        return $this->success(['release' => $this->releases->update($release, $data, auth()->id())]);
    }

    public function destroy(EngineeringRelease $release): JsonResponse
    {
        abort_if($release->company_id !== auth()->user()->company_id, 403);
        $this->releases->delete($release, auth()->id());
        return $this->success(['message' => 'Release deleted']);
    }

    public function transition(Request $request, EngineeringRelease $release): JsonResponse
    {
        abort_if($release->company_id !== auth()->user()->company_id, 403);
        $data   = $request->validate(['status' => 'required|string', 'reason' => 'nullable|string']);
        $next   = ReleaseStatus::from($data['status']);
        return $this->success(['release' => $this->releases->transition($release, $next, auth()->id(), $data['reason'] ?? '')]);
    }

    public function clone(Request $request, EngineeringRelease $release): JsonResponse
    {
        abort_if($release->company_id !== auth()->user()->company_id, 403);
        $data    = $request->validate(['name' => 'required|string|max:255']);
        return $this->success(['release' => $this->releases->clone($release, $data['name'], auth()->id())], 201);
    }

    public function archive(EngineeringRelease $release): JsonResponse
    {
        abort_if($release->company_id !== auth()->user()->company_id, 403);
        return $this->success(['release' => $this->releases->archive($release, auth()->id())]);
    }

    public function addTasks(Request $request, EngineeringRelease $release): JsonResponse
    {
        abort_if($release->company_id !== auth()->user()->company_id, 403);
        $data = $request->validate(['task_ids' => 'required|array', 'task_ids.*' => 'uuid']);
        return $this->success(['release' => $this->releases->addTasks($release, $data['task_ids'], auth()->id())]);
    }

    public function removeTasks(Request $request, EngineeringRelease $release): JsonResponse
    {
        abort_if($release->company_id !== auth()->user()->company_id, 403);
        $data = $request->validate(['task_ids' => 'required|array', 'task_ids.*' => 'uuid']);
        return $this->success(['release' => $this->releases->removeTasks($release, $data['task_ids'], auth()->id())]);
    }

    public function validate(EngineeringRelease $release): JsonResponse
    {
        abort_if($release->company_id !== auth()->user()->company_id, 403);
        $results = $this->validation->runAll($release);
        $score   = $this->scorer->calculate($release);
        return $this->success(['validation' => $results, 'readiness' => $score]);
    }

    public function readiness(EngineeringRelease $release): JsonResponse
    {
        abort_if($release->company_id !== auth()->user()->company_id, 403);
        return $this->success($this->scorer->calculate($release));
    }

    public function analyzeRisks(EngineeringRelease $release): JsonResponse
    {
        abort_if($release->company_id !== auth()->user()->company_id, 403);
        return $this->success($this->risks->analyze($release));
    }

    public function generateReports(EngineeringRelease $release): JsonResponse
    {
        abort_if($release->company_id !== auth()->user()->company_id, 403);
        $reports = $this->reports->generateAll($release);
        return $this->success(['reports' => $reports, 'count' => count($reports)]);
    }

    public function analyzeDependencies(EngineeringRelease $release): JsonResponse
    {
        abort_if($release->company_id !== auth()->user()->company_id, 403);
        $deps    = $this->dependencies->analyzeAndSeed($release);
        $summary = $this->dependencies->getBlockingSummary($release);
        return $this->success(['dependencies' => $deps, 'summary' => $summary]);
    }

    public function dashboard(): JsonResponse
    {
        return $this->success($this->releases->dashboard(auth()->user()->company_id));
    }

    public function audit(EngineeringRelease $release): JsonResponse
    {
        abort_if($release->company_id !== auth()->user()->company_id, 403);
        return $this->success(['audit' => $release->audit()->orderByDesc('occurred_at')->limit(100)->get()]);
    }
}
