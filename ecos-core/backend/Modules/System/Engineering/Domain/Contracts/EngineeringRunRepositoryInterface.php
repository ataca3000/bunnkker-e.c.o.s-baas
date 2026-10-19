<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Contracts;

use Illuminate\Pagination\LengthAwarePaginator;
use Modules\System\Engineering\Domain\Models\EngineeringRun;

interface EngineeringRunRepositoryInterface
{
    public function latest(): ?EngineeringRun;

    public function paginate(int $perPage, int $page): LengthAwarePaginator;

    public function findById(string $id): ?EngineeringRun;

    /** Returns overall_score for the last N runs, ordered oldest-first. */
    public function scoreTrend(int $limit = 30): array;

    public function findByReportFile(string $filePath): ?EngineeringRun;
}
