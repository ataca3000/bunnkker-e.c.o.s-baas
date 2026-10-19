<?php

declare(strict_types=1);

namespace Modules\Inventory\WasteInvestigations\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WasteInvestigationEvent extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'investigation_id',
        'event_type',
        'performed_by',
        'description',
        'changes',
        'occurred_at',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'changes' => 'array',
            'occurred_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<WasteInvestigation, $this> */
    public function investigation(): BelongsTo
    {
        return $this->belongsTo(WasteInvestigation::class, 'investigation_id');
    }

    /**
     * Convenience factory — records a timeline/audit event.
     *
     * @param  array<string, array{from: mixed, to: mixed}>|null  $changes
     */
    public static function log(
        string $investigationId,
        string $eventType,
        ?string $performedBy = null,
        ?string $description = null,
        ?array $changes = null,
    ): static {
        return static::query()->create([
            'investigation_id' => $investigationId,
            'event_type' => $eventType,
            'performed_by' => $performedBy,
            'description' => $description,
            'changes' => $changes,
            'occurred_at' => now(),
        ]);
    }
}
