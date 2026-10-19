<?php

namespace Modules\System\Engineering\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Modules\Core\Http\Traits\HasApiResponse;
use Modules\System\Engineering\Application\Services\PatchRollbackService;
use Modules\System\Engineering\Domain\Models\RepairPatch;
use RuntimeException;

class PatchRollbackController
{
    use HasApiResponse;

    public function __construct(
        private readonly PatchRollbackService $rollbackService,
    ) {}

    public function snapshots(string $patchId): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        $patch = RepairPatch::where('company_id', $companyId)->findOrFail($patchId);

        $snapshots = $this->rollbackService->getSnapshots($patch->id)->map(fn ($snapshot) => [
            'file_path'    => $snapshot->file_path,
            'file_existed' => $snapshot->file_existed,
            'is_restored'  => $snapshot->is_restored,
            'restored_at'  => $snapshot->restored_at,
            'created_at'   => $snapshot->created_at,
        ]);

        return $this->success($snapshots);
    }

    public function rollback(string $patchId): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        $patch = RepairPatch::where('company_id', $companyId)->findOrFail($patchId);

        abort_if(! $patch->is_applied, 422, 'Patch is not applied; nothing to roll back');

        try {
            $count = $this->rollbackService->rollback($patch, auth()->id());
        } catch (RuntimeException $e) {
            return $this->error($e->getMessage(), 422);
        }

        return $this->success([
            'restored_files' => $count,
            'patch'          => $patch->fresh(),
        ]);
    }
}
