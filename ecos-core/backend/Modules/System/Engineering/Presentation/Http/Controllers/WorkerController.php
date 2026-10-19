<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\System\Engineering\Application\Services\WorkerManager;
use Modules\System\Engineering\Domain\Enums\WorkerStatus;
use Modules\System\Engineering\Domain\Models\EngineeringTask;
use Modules\System\Engineering\Domain\Models\EngineeringWorker;
use Modules\System\Engineering\Domain\Models\EngineeringWorkerSession;
use Modules\System\Traits\HasApiResponse;

final class WorkerController
{
    use HasApiResponse;

    public function __construct(private readonly WorkerManager $workerManager) {}

    public function index(Request $request): JsonResponse
    {
        $companyId = auth()->user()->company_id;
        $paginator = $this->workerManager->list(
            $companyId,
            $request->only('status', 'worker_type'),
            (int) $request->get('page', 1),
            (int) $request->get('per_page', 25),
        );
        return $this->success([
            'data' => $paginator->items(),
            'meta' => [
                'page'      => $paginator->currentPage(),
                'per_page'  => $paginator->perPage(),
                'total'     => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'                 => 'required|string|max:255',
            'worker_type'          => 'required|string|in:general,specialist,dedicated',
            'repository_path'      => 'nullable|string|max:500',
            'workspace_base'       => 'nullable|string|max:500',
            'max_concurrent_tasks' => 'nullable|integer|min:1|max:10',
            'priority'             => 'nullable|integer|min:1|max:100',
            'metadata'             => 'nullable|array',
        ]);
        $worker = $this->workerManager->create(auth()->user()->company_id, $data);
        return $this->success(['worker' => $worker], 201);
    }

    public function show(EngineeringWorker $worker): JsonResponse
    {
        abort_if($worker->company_id !== auth()->user()->company_id, 403);
        $worker->load(['currentTask', 'currentSession', 'sessions' => fn($q) => $q->latest()->limit(10)]);
        return $this->success(['worker' => $worker]);
    }

    public function start(EngineeringWorker $worker): JsonResponse
    {
        abort_if($worker->company_id !== auth()->user()->company_id, 403);
        return $this->success(['worker' => $this->workerManager->start($worker)]);
    }

    public function stop(EngineeringWorker $worker): JsonResponse
    {
        abort_if($worker->company_id !== auth()->user()->company_id, 403);
        $this->workerManager->stop($worker);
        return $this->success(['message' => 'Worker stopped']);
    }

    public function drain(EngineeringWorker $worker): JsonResponse
    {
        abort_if($worker->company_id !== auth()->user()->company_id, 403);
        $this->workerManager->drain($worker);
        return $this->success(['message' => 'Worker draining']);
    }

    public function destroy(EngineeringWorker $worker): JsonResponse
    {
        abort_if($worker->company_id !== auth()->user()->company_id, 403);
        $this->workerManager->destroy($worker);
        return $this->success(['message' => 'Worker destroyed']);
    }

    public function heartbeat(Request $request, EngineeringWorker $worker): JsonResponse
    {
        abort_if($worker->company_id !== auth()->user()->company_id, 403);
        $metrics = $request->validate([
            'status'   => 'nullable|string',
            'progress' => 'nullable|integer|min:0|max:100',
            'message'  => 'nullable|string|max:500',
        ]);
        $this->workerManager->heartbeat($worker, $metrics);
        return $this->success(['status' => 'ok', 'server_time' => now()->toIsoString()]);
    }

    public function sessions(EngineeringWorker $worker, Request $request): JsonResponse
    {
        abort_if($worker->company_id !== auth()->user()->company_id, 403);
        $sessions = EngineeringWorkerSession::where('worker_id', $worker->id)
            ->with('task:id,title,status')
            ->latest()
            ->paginate((int) $request->get('per_page', 20));
        return $this->success([
            'data' => $sessions->items(),
            'meta' => [
                'page'  => $sessions->currentPage(),
                'total' => $sessions->total(),
            ],
        ]);
    }
}
