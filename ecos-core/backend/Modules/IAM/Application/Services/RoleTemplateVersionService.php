<?php

declare(strict_types=1);

namespace Modules\IAM\Application\Services;

use Illuminate\Support\Collection;
use Modules\IAM\Domain\Models\RoleTemplate;
use Modules\IAM\Domain\Models\RoleTemplateVersion;

/**
 * Append-only version history for role templates (ADR-039, Decision 4).
 * Snapshots are never overwritten — a published version is permanent.
 */
class RoleTemplateVersionService
{
    /**
     * Snapshot the template's CURRENT state as an immutable version row.
     * Idempotent per (template, version): re-snapshotting the same version is a no-op.
     */
    public function snapshot(RoleTemplate $template, ?string $note = null, ?int $actorId = null): RoleTemplateVersion
    {
        return RoleTemplateVersion::firstOrCreate(
            [
                'role_template_id' => $template->id,
                'version' => $template->version,
            ],
            [
                'key' => $template->key,
                'name' => $template->name,
                'category' => $template->category,
                'status' => $template->status,
                'definition' => $template->definition,
                'change_note' => $note,
                'created_by' => $actorId,
                'created_at' => now(),
            ],
        );
    }

    /** @return Collection<int,RoleTemplateVersion> newest first */
    public function history(RoleTemplate $template): Collection
    {
        return $template->versions()->get();
    }

    public function versionAt(RoleTemplate $template, int $version): ?RoleTemplateVersion
    {
        return $template->versions()->where('version', $version)->first();
    }
}
