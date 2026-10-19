<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Modules\System\Engineering\Domain\Models\EngineeringExecutionArtifact;
use Modules\System\Engineering\Domain\Models\ExecutionSession;

final class AgentArtifactService
{
    private const DISK = 'local';

    public function listForSession(ExecutionSession $session): Collection
    {
        return $session->artifacts()->get();
    }

    public function store(
        ExecutionSession $session,
        UploadedFile $file,
        string $artifactType,
    ): EngineeringExecutionArtifact {
        $filename    = $file->getClientOriginalName();
        $storagePath = "engineering/sessions/{$session->id}/artifacts/{$filename}";
        $content     = $file->get();

        Storage::disk(self::DISK)->put($storagePath, $content);

        return EngineeringExecutionArtifact::create([
            'session_id'   => $session->id,
            'company_id'   => $session->company_id,
            'artifact_type' => $artifactType,
            'filename'     => $filename,
            'content_type' => $file->getMimeType() ?? 'application/octet-stream',
            'size_bytes'   => $file->getSize(),
            'storage_disk' => self::DISK,
            'storage_path' => $storagePath,
            'checksum'     => md5($content),
        ]);
    }

    public function storeRaw(
        ExecutionSession $session,
        string $content,
        string $filename,
        string $artifactType,
        string $contentType = 'text/plain',
    ): EngineeringExecutionArtifact {
        $storagePath = "engineering/sessions/{$session->id}/artifacts/{$filename}";

        Storage::disk(self::DISK)->put($storagePath, $content);

        return EngineeringExecutionArtifact::create([
            'session_id'    => $session->id,
            'company_id'    => $session->company_id,
            'artifact_type' => $artifactType,
            'filename'      => $filename,
            'content_type'  => $contentType,
            'size_bytes'    => strlen($content),
            'storage_disk'  => self::DISK,
            'storage_path'  => $storagePath,
            'checksum'      => md5($content),
        ]);
    }

    public function delete(EngineeringExecutionArtifact $artifact): void
    {
        Storage::disk($artifact->storage_disk ?? self::DISK)->delete($artifact->storage_path);

        $artifact->delete();
    }
}
