<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Signature and photo evidence captured at a stop. */
class DeliveryProof extends Model
{
    protected $table = 'distribution_delivery_proofs';

    protected $fillable = [
        'stop_id',
        'signature_path',
        'photos',
        'notes',
        'captured_at',
        'captured_by',
    ];

    protected function casts(): array
    {
        return [
            'photos' => 'array',
            'captured_at' => 'datetime',
        ];
    }

    public function stop(): BelongsTo
    {
        return $this->belongsTo(DeliveryStop::class, 'stop_id');
    }

    public function hasSignature(): bool
    {
        return $this->signature_path !== null && $this->signature_path !== '';
    }

    public function photoCount(): int
    {
        return count($this->photos ?? []);
    }
}
