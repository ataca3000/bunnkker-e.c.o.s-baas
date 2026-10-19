<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Modules\System\Engineering\Application\Services\ClusterHealthService;
use Modules\System\Engineering\Application\Services\ClusterRecoveryService;
use Modules\System\Engineering\Domain\Models\EngineeringWorker;
use Modules\System\Traits\HasApiResponse;

final class ClusterHealthController
{
    use HasApiResponse;

    public function __construct(
        private readonly ClusterHealthService $healthService,
        private readonly ClusterRecoveryService $recoveryService,
    ) {}

    public function report(): JsonResponse
    {
        return $this->success($this->healthService->getHealthReport(auth()->user()->company_id));
    }

    public function workerHealth(EngineeringWorker $worker): JsonResponse
    {
        abort_if($worker->company_id !== auth()->user()->company_id, 403);
        return $this->success($this->healthService->checkWorkerHealth($worker));
    }

    public function recoverWorker(EngineeringWorker $worker): JsonResponse
    {
        abort_if($worker->company_id !== auth()->user()->company_id, 403);
        $success = $this->recoveryService->recoverWorker($worker);
        return $this->success(['success' => $success, 'message' => $success ? 'Worker recovered' : 'Recovery failed']);
    }
}
