<?php

declare(strict_types=1);

namespace Modules\Purchasing\Suppliers\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Modules\Purchasing\Suppliers\Domain\Models\Supplier;
use Modules\Purchasing\Suppliers\Domain\Models\SupplierDocument;

final class SupplierDocumentController extends Controller
{
    use HasApiResponse;

    private const ALLOWED_TYPES = [
        'commercial_registration',
        'tax_card',
        'contract',
        'certificate',
        'attachment',
    ];

    private const MAX_FILE_MB = 20;

    public function index(string $supplierId): JsonResponse
    {
        $supplier = Supplier::query()->findOrFail($supplierId);

        $docs = SupplierDocument::query()
            ->where('supplier_id', $supplier->id)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (SupplierDocument $d): array => $this->format($d));

        return $this->success($docs->values());
    }

    public function store(Request $request, string $supplierId): JsonResponse
    {
        $supplier = Supplier::query()->findOrFail($supplierId);

        $request->validate([
            'file' => ['required', 'file', 'max:'.(self::MAX_FILE_MB * 1024), 'mimes:pdf,jpg,jpeg,png,doc,docx,xls,xlsx'],
            'document_type' => ['required', 'string', 'in:'.implode(',', self::ALLOWED_TYPES)],
            'name' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $file = $request->file('file');
        $path = $file->store("supplier-documents/{$supplier->id}", 'local');
        $name = $request->input('name') ?: $file->getClientOriginalName();

        $doc = SupplierDocument::query()->create([
            'supplier_id' => $supplier->id,
            'document_type' => $request->input('document_type'),
            'name' => $name,
            'file_path' => $path,
            'mime_type' => $file->getMimeType() ?? 'application/octet-stream',
            'file_size' => $file->getSize(),
            'notes' => $request->input('notes'),
            'uploaded_by' => Auth::id(),
        ]);

        return $this->success($this->format($doc), 'Document uploaded.', 201);
    }

    public function destroy(string $supplierId, string $documentId): JsonResponse
    {
        $doc = SupplierDocument::query()
            ->where('supplier_id', $supplierId)
            ->findOrFail($documentId);

        Storage::disk('local')->delete($doc->file_path);
        $doc->delete();

        return $this->success(null, 'Document deleted.');
    }

    public function download(string $supplierId, string $documentId): Response
    {
        $doc = SupplierDocument::query()
            ->where('supplier_id', $supplierId)
            ->findOrFail($documentId);

        if (! Storage::disk('local')->exists($doc->file_path)) {
            abort(404, 'File not found on disk.');
        }

        return Storage::disk('local')->download($doc->file_path, $doc->name);
    }

    /** @return array<string, mixed> */
    private function format(SupplierDocument $doc): array
    {
        return [
            'id' => $doc->id,
            'supplier_id' => $doc->supplier_id,
            'document_type' => $doc->document_type,
            'name' => $doc->name,
            'mime_type' => $doc->mime_type,
            'file_size' => $doc->file_size,
            'notes' => $doc->notes,
            'uploaded_by' => $doc->uploaded_by,
            'created_at' => $doc->created_at?->toIso8601String(),
        ];
    }
}
