<?php

declare(strict_types=1);

namespace App\Core\Documents;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class DocumentService
{
    private const DISK = 'local';

    /**
     * Attach a file to any entity.
     *
     * @param  array<string, mixed>  $metadata
     */
    public function attach(
        string $companyId,
        string $subjectType,
        string $subjectId,
        string $documentType,
        UploadedFile $file,
        ?int $uploadedBy = null,
        ?string $notes = null,
    ): Document {
        $path = $file->store(
            "documents/{$companyId}/{$subjectType}/{$subjectId}",
            self::DISK,
        );

        return Document::create([
            'id' => Str::uuid()->toString(),
            'company_id' => $companyId,
            'subject_type' => $subjectType,
            'subject_id' => $subjectId,
            'document_type' => $documentType,
            'name' => $file->getClientOriginalName(),
            'file_path' => $path,
            'mime_type' => $file->getMimeType(),
            'file_size' => $file->getSize(),
            'uploaded_by' => $uploadedBy,
            'notes' => $notes,
            'version' => '1.0',
            'is_active' => true,
        ]);
    }

    /**
     * @return \Illuminate\Support\Collection<int, Document>
     */
    public function getFor(string $subjectType, string $subjectId, ?string $documentType = null): \Illuminate\Support\Collection
    {
        return Document::where('subject_type', $subjectType)
            ->where('subject_id', $subjectId)
            ->when($documentType, fn ($q, $t) => $q->where('document_type', $t))
            ->where('is_active', true)
            ->orderByDesc('created_at')
            ->get();
    }

    public function delete(string $documentId): void
    {
        $doc = Document::findOrFail($documentId);
        Storage::disk(self::DISK)->delete($doc->file_path);
        $doc->delete();
    }

    public function getDownloadUrl(Document $document): string
    {
        return Storage::disk(self::DISK)->url($document->file_path);
    }
}
