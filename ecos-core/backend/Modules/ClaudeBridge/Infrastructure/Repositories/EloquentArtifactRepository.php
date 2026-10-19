<?php

declare(strict_types=1);

namespace Modules\ClaudeBridge\Infrastructure\Repositories;

use Modules\ClaudeBridge\Domain\Contracts\ArtifactRepositoryInterface;
use Modules\ClaudeBridge\Domain\Models\Artifact;

final class EloquentArtifactRepository implements ArtifactRepositoryInterface
{
    public function findById(string $id): ?Artifact
    {
        return Artifact::find($id);
    }

    public function findByIdForCompany(string $id, string $companyId): ?Artifact
    {
        return Artifact::where('id', $id)
            ->whereHas('task', fn ($q) => $q->where('company_id', $companyId))
            ->first();
    }

    public function forTask(string $taskId): mixed
    {
        return Artifact::where('task_id', $taskId)->get();
    }

    public function create(array $attributes): Artifact
    {
        return Artifact::create($attributes);
    }
}
