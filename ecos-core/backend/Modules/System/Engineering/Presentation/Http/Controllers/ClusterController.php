<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\System\Engineering\Application\Services\ClusterCoordinator;
use Modules\System\Engineering\Application\Services\ClusterRecoveryService;
use Modules\System\Traits\HasApiResponse;

final class ClusterController
{
    use HasApiResponse;

    public function __construct(
        private readonly ClusterCoordinator $coordinator,
        private readonly ClusterRecoveryService $recovery,
    ) {}

    public function dashboard(): JsonResponse
    {
        return $this->success($this->coordinator->getDashboard(auth()->user()->company_id));
    }

    public function tick(Request $request): JsonResponse
    {
        $result = $this->coordinator->tick(auth()->user()->company_id);
        return $this->success($result);
    }

    public function purgeExpiredLocks(Request $request): JsonResponse
    {
        $result = $this->recovery->purgeExpiredLocks(auth()->user()->company_id);
        return $this->success(array_merge($result, ['message' => 'Expired locks purged']));
    }

    public function recoverStaleWorkers(Request $request): JsonResponse
    {
        $count = $this->recovery->recoverStaleWorkers(auth()->user()->company_id);
        return $this->success(['recovered' => $count, 'message' => "{$count} stale workers recovered"]);
    }
}
