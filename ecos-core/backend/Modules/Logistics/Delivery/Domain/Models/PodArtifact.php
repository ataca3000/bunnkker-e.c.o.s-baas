<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Logistics\Delivery\Domain\Enums\PodArtifactKind;

/** Signature, photo, ID scan or OTP evidence attached to a POD. Append-only. */
class PodArtifact extends Model
{
    protected $table = 'delivery_pod_artifacts';

    protected $fillable = [
        'pod_id', 'kind', 'file_path', 'file_name', 'mime_type', 'size_bytes',
        'reference', 'notes', 'captured_at', 'captured_by',
    ];

    protected function casts(): array
    {
        return [
            'kind' => PodArtifactKind::class,
            'size_bytes' => 'integer',
            'captured_at' => 'datetime',
        ];
    }

    public function pod(): BelongsTo
    {
        return $this->belongsTo(ProofOfDelivery::class, 'pod_id');
    }
}
