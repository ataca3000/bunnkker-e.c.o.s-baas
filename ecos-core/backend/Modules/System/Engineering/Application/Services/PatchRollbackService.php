<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\File;
use Modules\System\Engineering\Domain\Models\PatchSnapshot;
use Modules\System\Engineering\Domain\Models\RepairPatch;
use RuntimeException;

/**
 * Snapshot + rollback engine for repair patches (TASK-ENG-V2-002 Self-Healing Pipeline).
 *
 * Before a patch is applied, snapshot() captures the original content of every
 * affected file. If validation later rejects the patch, rollback() restores
 * every file to its pre-patch state (deleting files the patch created).
 */
class PatchRollbackService
{
    /**
     * Capture pre-apply snapshots for every file the patch touches.
     *
     * @return array<int, PatchSnapshot>
     */
    public function snapshot(RepairPatch $patch): array
    {
        $base = rtrim(config('engineering.self_healing.working_directory', base_path()), '/');

        $snapshots = [];

        foreach ($patch->files_affected ?? [] as $path) {
            $full   = $base.'/'.ltrim($path, '/');
            $exists = File::exists($full);

            $snapshots[] = PatchSnapshot::create([
                'patch_id'         => $patch->id,
                'session_id'       => $patch->session_id,
                'company_id'       => $patch->company_id,
                'file_path'        => $path,
                'original_content' => $exists ? File::get($full) : null,
                'file_existed'     => $exists,
                'is_restored'      => false,
                'created_at'       => now(),
            ]);
        }

        return $snapshots;
    }

    /**
     * Restore every affected file to its pre-patch state.
     *
     * Files that existed before the patch are rewritten with their original
     * content; files the patch created are deleted.
     *
     * @return int number of snapshots restored
     */
    public function rollback(RepairPatch $patch, string $actorId): int
    {
        $snapshots = PatchSnapshot::where('patch_id', $patch->id)
            ->where('is_restored', false)
            ->get();

        if ($snapshots->isEmpty()) {
            throw new RuntimeException('No snapshots available for rollback');
        }

        $base     = rtrim(config('engineering.self_healing.working_directory', base_path()), '/');
        $restored = 0;

        foreach ($snapshots as $snapshot) {
            $full = $base.'/'.ltrim($snapshot->file_path, '/');

            if ($snapshot->file_existed) {
                File::ensureDirectoryExists(dirname($full));
                File::put($full, $snapshot->original_content ?? '');
            } elseif (File::exists($full)) {
                // File was created by the patch — remove it.
                File::delete($full);
            }

            $snapshot->update([
                'is_restored' => true,
                'restored_at' => now(),
                'restored_by' => $actorId,
            ]);

            $restored++;
        }

        $patch->update([
            'is_applied'          => false,
            'verification_status' => 'failed',
        ]);

        return $restored;
    }

    public function getSnapshots(string $patchId): Collection
    {
        return PatchSnapshot::where('patch_id', $patchId)
            ->orderBy('created_at', 'asc')
            ->get();
    }

    public function hasSnapshots(string $patchId): bool
    {
        return PatchSnapshot::where('patch_id', $patchId)->exists();
    }
}
