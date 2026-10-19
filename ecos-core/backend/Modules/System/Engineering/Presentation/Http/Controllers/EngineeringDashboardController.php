<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\System\Engineering\Domain\Contracts\EngineeringRunRepositoryInterface;
use Modules\System\Engineering\Domain\Models\EngineeringFinding;
use Modules\System\Engineering\Presentation\Http\Resources\EngineeringFindingResource;
use Modules\System\Engineering\Presentation\Http\Resources\EngineeringRunResource;

final class EngineeringDashboardController extends Controller
{
    use HasApiResponse;

    public function __construct(
        private readonly EngineeringRunRepositoryInterface $repository,
    ) {}

    /** GET /api/system/engineering/dashboard */
    public function dashboard(): JsonResponse
    {
        $latest = $this->repository->latest();
        $trend  = $this->repository->scoreTrend(30);

        if ($latest === null) {
            return $this->success([
                'has_data'      => false,
                'latest_run'    => null,
                'score_trend'   => [],
                'findings_count'=> ['CRITICAL' => 0, 'HIGH' => 0, 'MEDIUM' => 0, 'LOW' => 0],
                'total_runs'    => 0,
            ]);
        }

        $findingCounts = EngineeringFinding::where('engineering_run_id', $latest->id)
            ->selectRaw('severity, count(*) as cnt')
            ->groupBy('severity')
            ->pluck('cnt', 'severity')
            ->toArray();

        $severityCounts = [
            'CRITICAL' => (int) ($findingCounts['CRITICAL'] ?? 0),
            'HIGH'     => (int) ($findingCounts['HIGH'] ?? 0),
            'MEDIUM'   => (int) ($findingCounts['MEDIUM'] ?? 0),
            'LOW'      => (int) ($findingCounts['LOW'] ?? 0),
        ];

        return $this->success([
            'has_data'       => true,
            'latest_run'     => new EngineeringRunResource($latest),
            'score_trend'    => $trend,
            'findings_count' => $severityCounts,
            'total_runs'     => \Modules\System\Engineering\Domain\Models\EngineeringRun::count(),
        ]);
    }

    /** GET /api/system/engineering/runs */
    public function runs(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 15);
        $page    = (int) $request->query('page', 1);

        $paginator = $this->repository->paginate($perPage, $page);

        return $this->success([
            'data' => EngineeringRunResource::collection($paginator->items()),
            'meta' => [
                'page'     => $paginator->currentPage(),
                'perPage'  => $paginator->perPage(),
                'total'    => $paginator->total(),
                'lastPage' => $paginator->lastPage(),
            ],
        ]);
    }

    /** GET /api/system/engineering/runs/{id} */
    public function show(string $id): JsonResponse
    {
        $run = $this->repository->findById($id);

        if ($run === null) {
            return $this->error('Run not found', 404);
        }

        return $this->success(new EngineeringRunResource($run));
    }

    /** GET /api/system/engineering/findings */
    public function findings(Request $request): JsonResponse
    {
        $perPage  = (int) $request->query('per_page', 25);
        $page     = (int) $request->query('page', 1);
        $severity = $request->query('severity');
        $runId    = $request->query('run_id');

        $query = EngineeringFinding::with('run')
            ->orderByRaw("CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END")
            ->orderByDesc('created_at');

        if ($severity) {
            $query->where('severity', strtoupper((string) $severity));
        }

        if ($runId) {
            $query->where('engineering_run_id', $runId);
        }

        $paginator = $query->paginate($perPage, ['*'], 'page', $page);

        return $this->success([
            'data' => EngineeringFindingResource::collection($paginator->items()),
            'meta' => [
                'page'     => $paginator->currentPage(),
                'perPage'  => $paginator->perPage(),
                'total'    => $paginator->total(),
                'lastPage' => $paginator->lastPage(),
            ],
        ]);
    }
}
