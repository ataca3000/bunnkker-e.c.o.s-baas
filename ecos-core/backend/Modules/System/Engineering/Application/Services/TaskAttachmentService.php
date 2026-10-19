<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Modules\System\Engineering\Domain\Models\EngineeringTask;
use Modules\System\Engineering\Domain\Models\EngineeringTaskAttachment;

class TaskAttachmentService
{
    public function listForTask(EngineeringTask $task): Collection
    {
        return EngineeringTaskAttachment::query()
            ->where('task_id', $task->id)
            ->with(['uploadedBy'])
            ->get();
    }

    public function upload(EngineeringTask $task, UploadedFile $file): EngineeringTaskAttachment
    {
        $originalName = $file->getClientOriginalName();
        $path = "engineering/tasks/{$task->id}/attachments/{$originalName}";

        Storage::disk('local')->putFileAs(
            "engineering/tasks/{$task->id}/attachments",
            $file,
            $originalName
        );

        return EngineeringTaskAttachment::create([
            'task_id'        => $task->id,
            'company_id'     => $task->company_id,
            'uploaded_by'    => Auth::id(),
            'filename'       => $originalName,
            'original_name'  => $originalName,
            'mime_type'      => $file->getClientMimeType(),
            'size'           => $file->getSize(),
            'disk'           => 'local',
            'path'           => $path,
        ]);
    }

    public function delete(EngineeringTaskAttachment $attachment): void
    {
        Storage::disk($attachment->disk ?? 'local')->delete($attachment->path);

        $attachment->delete();
    }
}
