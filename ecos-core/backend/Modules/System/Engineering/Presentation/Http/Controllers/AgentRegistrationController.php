<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use Modules\Core\Http\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Modules\System\Engineering\Domain\Enums\AgentStatus;
use Modules\System\Engineering\Domain\Models\EngineeringAgent;
use Modules\System\Engineering\Application\Services\AgentHeartbeatService;
use Modules\System\Engineering\Application\Services\AgentRegistrationService;
use Modules\System\Engineering\Application\Services\ExecutionSessionService;
use Modules\System\Engineering\Presentation\Http\Resources\AgentResource;

class AgentRegistrationController extends Controller
{
    use HasApiResponse;

    public function __construct(
        private readonly AgentRegistrationService $registrationService,
        private readonly AgentHeartbeatService $heartbeatService,
        private readonly ExecutionSessionService $sessionService,
    ) {}

    /**
     * POST /system/engineering/agents/register
     *
     * Register a new agent. This is the ONLY endpoint that returns the raw API key.
     */
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'                => ['required', 'string', 'max:200'],
            'agent_type'          => ['required', 'string', 'in:standard,specialist,orchestrator'],
            'machine_fingerprint' => ['required', 'string', 'max:255'],
            'os_info'             => ['nullable', 'string'],
            'ip_address'          => ['nullable', 'ip'],
            'version'             => ['nullable', 'string'],
            'platform_info'       => ['nullable', 'array'],
            'capabilities'        => ['nullable', 'array'],
        ]);

        $companyId = Auth::user()->company_id;

        $result = $this->registrationService->register($companyId, $validated);

        return $this->success([
            'agent'   => new AgentResource($result['agent']),
            'api_key' => $result['api_key'],
        ]);
    }

    /**
     * POST /system/engineering/agents/{agent}/deregister
     */
    public function deregister(EngineeringAgent $agent): JsonResponse
    {
        $this->registrationService->deregister($agent);

        return $this->success(['deregistered' => true]);
    }

    /**
     * POST /system/engineering/agents/{agent}/heartbeat
     */
    public function heartbeat(Request $request, EngineeringAgent $agent): JsonResponse
    {
        $validated = $request->validate([
            'status'          => ['required', 'string', 'in:' . implode(',', array_column(AgentStatus::cases(), 'value'))],
            'cpu_percent'     => ['required', 'numeric', 'min:0', 'max:100'],
            'memory_mb_used'  => ['required', 'integer'],
            'disk_free_gb'    => ['required', 'numeric'],
            'load_average'    => ['required', 'numeric'],
            'current_task_id' => ['nullable', 'uuid'],
        ]);

        $heartbeat = $this->heartbeatService->record($agent, $validated);

        return $this->success([
            'heartbeat'               => $heartbeat->only(['status', 'cpu_percent', 'memory_mb_used', 'recorded_at']),
            'stale_threshold_minutes' => 5,
        ]);
    }

    /**
     * GET /system/engineering/agents
     */
    public function index(Request $request): JsonResponse
    {
        $companyId = Auth::user()->company_id;

        $query = EngineeringAgent::query()
            ->where('company_id', $companyId)
            ->with(['latestHeartbeat', 'currentSession']);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        $paginated = $query->paginate(25);

        return $this->success(
            AgentResource::collection($paginated)->resolve(),
            meta: [
                'current_page' => $paginated->currentPage(),
                'per_page'     => $paginated->perPage(),
                'total'        => $paginated->total(),
                'last_page'    => $paginated->lastPage(),
            ]
        );
    }

    /**
     * GET /system/engineering/agents/{agent}
     */
    public function show(EngineeringAgent $agent): JsonResponse
    {
        $agent->load([
            'latestHeartbeat',
            'capabilities',
            'currentSession.task',
            'agentLogs' => fn ($q) => $q->latest()->limit(50),
        ]);

        return $this->success(new AgentResource($agent));
    }

    /**
     * GET /system/engineering/agents/dashboard
     */
    public function dashboard(): JsonResponse
    {
        $companyId = Auth::user()->company_id;

        return $this->success($this->sessionService->dashboard($companyId));
    }
}
