<?php

declare(strict_types=1);

namespace Modules\Logistics\Drivers\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Drivers\Domain\Models\DriverDocument;

/**
 * @mixin DriverDocument
 */
class DriverDocumentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'driver_id' => $this->driver_id,
            'type' => $this->type,
            'title' => $this->title,
            // file_path is intentionally NOT exposed; downloads go through the
            // authenticated download endpoint rather than a guessable path.
            'file_name' => $this->file_name,
            'mime_type' => $this->mime_type,
            'size_bytes' => $this->size_bytes,
            'issued_at' => $this->issued_at?->format('Y-m-d'),
            'expires_at' => $this->expires_at?->format('Y-m-d'),
            'is_expired' => $this->isExpired(),
            'notes' => $this->notes,
            'uploaded_by' => $this->uploaded_by,
            'download_url' => "/api/logistics/drivers/{$this->driver_id}/documents/{$this->id}/download",
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
