<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Infrastructure\Repositories;

use Illuminate\Pagination\LengthAwarePaginator;
use Modules\System\Engineering\Domain\Contracts\EngineeringRunRepositoryInterface;
use Modules\System\Engineering\Domain\Models\EngineeringRun;

final class EloquentEngineeringRunRepository implements EngineeringRunRepositoryInterface
{
    public function latest(): ?EngineeringRun
    {
        return EngineeringRun::orderByDesc('certified_at')->first();
    }

    public function paginate(int $perPage, int $page): LengthAwarePaginator
    {
        return EngineeringRun::orderByDesc('certified_at')
            ->paginate($perPage, ['*'], 'page', $page);
    }

    public function findById(string $id): ?EngineeringRun
    {
        return EngineeringRun::with('findings')->find($id);
    }

    public function scoreTrend(int $limit = 30): array
    {
        return EngineeringRun::orderByDesc('certified_at')
            ->limit($limit)
            ->get(['id', 'overall_score', 'release_ready', 'certified_at'])
            ->sortBy('certified_at')
            ->map(fn (EngineeringRun $r) => [
                'date'          => $r->certified_at->toDateString(),
                'score'         => $r->overall_score,
                'release_ready' => $r->release_ready,
            ])
            ->values()
            ->toArray();
    }

    public function findByReportFile(string $filePath): ?EngineeringRun
    {
        return EngineeringRun::where('report_file', $filePath)->first();
    }
}
