<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Handles file upload to Laravel public storage.
 * Returns a relative path for DB storage and a full URL for immediate display.
 */
final class MediaController extends Controller
{
    use HasApiResponse;

    /** Contexts that allow document uploads (images + PDF). */
    private const DOCUMENT_CONTEXTS = ['order-proof'];

    public function upload(Request $request): JsonResponse
    {
        $context = $request->input('context', 'raw-materials');

        if (in_array($context, self::DOCUMENT_CONTEXTS, true)) {
            $request->validate([
                'file' => ['required', 'file', 'max:10240', 'mimes:jpeg,jpg,png,webp,gif,pdf'],
                'context' => ['nullable', 'string'],
            ]);
        } else {
            $request->validate([
                'file' => ['required', 'file', 'image', 'max:5120', 'mimes:jpeg,jpg,png,webp,gif'],
                'context' => ['nullable', 'string', 'in:raw-materials,products,packaging-materials,brands,companies,business-accounts'],
            ]);
        }

        $file = $request->file('file');
        $ext = strtolower($file->getClientOriginalExtension() ?: 'webp');
        $path = $context.'/'.Str::ulid().'.'.$ext;

        Storage::disk('public')->put($path, file_get_contents($file->getRealPath()));

        return $this->success([
            'path' => $path,
            'url' => Storage::disk('public')->url($path),
        ]);
    }
}
