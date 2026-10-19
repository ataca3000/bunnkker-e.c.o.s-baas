<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use Modules\Core\Http\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Modules\System\Engineering\Domain\Models\ExecutionSession;
use Modules\System\Engineering\Application\Services\AgentArtifactService;
use Modules\System\Engineering\Application\Services\ExecutionSessionService;

class ExecutionSessionController extends Controller
{
    use HasApiResponse;

    public function __construct(
        private readonly ExecutionSessionService $sessionService,
        private readonly AgentArtifactService $artifactService,
    ) {}

    /**
     * GET /system/engineering/sessions
     */
    public function index(Request $request): JsonResponse
    {
        $companyId = Auth::user()->company_id;

        $query = ExecutionSession::query()
            ->where('company_id', $companyId)
            ->with([
                'task:id,title',
                'agent:id,name',
            ]);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('agent_id')) {
            $query->where('agent_id', $request->input('agent_id'));
        }

        if ($request->filled('task_id')) {
            $query->where('task_id', $request->input('task_id'));
        }

        $paginated = $query->latest()->paginate(25);

        return $this->success(
            $paginated->items(),
            meta: [
                'current_page' => $paginated->currentPage(),
                'per_page'     => $paginated->perPage(),
                'total'        => $paginated->total(),
                'last_page'    => $paginated->lastPage(),
            ]
        );
    }

    /**
     * GET /system/engineering/sessions/{session}
     */
    public function show(ExecutionSession $session): JsonResponse
    {
        $session->load([
            'task',
            'agent',
            'artifacts',
            'events' => fn ($q) => $q->latest()->limit(200),
            'workspaceSession',
        ]);

        return $this->success($session);
    }

    /**
     * POST /system/engineering/sessions/{session}/progress
     */
    public function updateProgress(Request $request, ExecutionSession $session): JsonResponse
    {
        $validated = $request->validate([
            'percent' => ['required', 'integer', 'min:0', 'max:100'],
            'message' => ['nullable', 'string', 'max:1000'],
        ]);

        $session = $this->sessionService->updateProgress($session, $validated);

        return $this->success($session);
    }

    /**
     * POST /system/engineering/sessions/{session}/complete
     */
    public function complete(Request $request, ExecutionSession $session): JsonResponse
    {
        $validated = $request->validate([
            'git_commit'        => ['nullable', 'string', 'max:40'],
            'cpu_seconds_used'  => ['nullable', 'integer'],
            'memory_mb_peak'    => ['nullable', 'integer'],
        ]);

        $session = $this->sessionService->complete($session, $validated);

        return $this->success($session);
    }

    /**
     * POST /system/engineering/sessions/{session}/fail
     */
    public function fail(Request $request, ExecutionSession $session): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:5000'],
        ]);

        $session = $this->sessionService->fail($session, $validated['reason']);

        return $this->success($session);
    }

    /**
     * POST /system/engineering/sessions/{session}/abort
     */
    public function abort(ExecutionSession $session): JsonResponse
    {
        $session = $this->sessionService->abort($session);

        return $this->success($session);
    }

    /**
     * POST /system/engineering/sessions/{session}/log
     */
    public function appendLog(Request $request, ExecutionSession $session): JsonResponse
    {
        $validated = $request->validate([
            'level'   => ['required', 'string', 'in:debug,info,warning,error'],
            'message' => ['required', 'string'],
            'context' => ['nullable', 'array'],
        ]);

        $entry = $this->sessionService->appendLog($session, $validated);

        return $this->success($entry);
    }

    /**
     * GET /system/engineering/sessions/{session}/artifacts
     */
    public function artifacts(ExecutionSession $session): JsonResponse
    {
        $artifacts = $this->artifactService->forSession($session);

        return $this->success($artifacts);
    }

    /**
     * POST /system/engineering/sessions/{session}/artifacts
     */
    public function uploadArtifact(Request $request, ExecutionSession $session): JsonResponse
    {
        $validated = $request->validate([
            'file'          => ['required', 'file', 'max:50000'],
            'artifact_type' => ['required', 'string'],
        ]);

        $artifact = $this->artifactService->upload(
            $session,
            $validated['file'],
            $validated['artifact_type'],
        );

        return $this->success($artifact);
    }
}
