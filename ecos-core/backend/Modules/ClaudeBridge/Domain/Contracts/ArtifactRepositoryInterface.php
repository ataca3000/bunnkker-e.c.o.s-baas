<?php

declare(strict_types=1);

namespace Modules\ClaudeBridge\Domain\Contracts;

use Modules\ClaudeBridge\Domain\Models\Artifact;

interface ArtifactRepositoryInterface
{
    public function findById(string $id): ?Artifact;

    public function findByIdForCompany(string $id, string $companyId): ?Artifact;

    /** @return \Illuminate\Database\Eloquent\Collection<int, Artifact> */
    public function forTask(string $taskId): mixed;

    public function create(array $attributes): Artifact;
}
