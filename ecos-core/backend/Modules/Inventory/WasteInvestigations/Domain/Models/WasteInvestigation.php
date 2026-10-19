<?php

declare(strict_types=1);

namespace Modules\Inventory\WasteInvestigations\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Inventory\CountSessions\Domain\Models\InventoryCountLine;
use Modules\Inventory\CountSessions\Domain\Models\InventoryCountSession;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Inventory\WasteInvestigations\Domain\Enums\WasteInvestigationOutcome;
use Modules\Inventory\WasteInvestigations\Domain\Enums\WasteInvestigationStatus;
use Modules\Organization\Warehouses\Domain\Models\Warehouse;

class WasteInvestigation extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'warehouse_id',
        'count_session_id',
        'count_line_id',
        'product_id',
        'quantity',
        'unit_cost',
        'total_cost',
        'damage_reason',
        'status',
        'outcome',
        'investigator_notes',
        'resolved_by',
        'resolved_at',
        'month',
        // Cost snapshot (set at resolution — immutable after that)
        'cost_snapshot_unit_cost',
        'cost_snapshot_total_value',
        'cost_method',
        'currency',
        'cost_snapshot_at',
        // Future-integration extension point
        'metadata',
        'created_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
            'unit_cost' => 'decimal:4',
            'total_cost' => 'decimal:2',
            'cost_snapshot_unit_cost' => 'decimal:4',
            'cost_snapshot_total_value' => 'decimal:2',
            'status' => WasteInvestigationStatus::class,
            'outcome' => WasteInvestigationOutcome::class,
            'resolved_at' => 'datetime',
            'cost_snapshot_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    protected static function booted(): void
    {
        // Auto-log 'created' event for every new investigation
        static::created(static function (WasteInvestigation $investigation): void {
            WasteInvestigationEvent::log(
                investigationId: $investigation->id,
                eventType: 'created',
                description: 'Waste investigation created.',
            );
        });
    }

    /** Whether a FIFO cost snapshot has been captured. */
    public function hasCostSnapshot(): bool
    {
        return $this->cost_snapshot_at !== null;
    }

    /** Days this investigation has been open (0 if resolved). */
    public function daysOpen(): int
    {
        if ($this->resolved_at !== null) {
            return (int) $this->created_at?->diffInDays($this->resolved_at);
        }

        return (int) $this->created_at?->diffInDays(now());
    }

    /** @return BelongsTo<InventoryCountSession, $this> */
    public function countSession(): BelongsTo
    {
        return $this->belongsTo(InventoryCountSession::class, 'count_session_id');
    }

    /** @return BelongsTo<InventoryCountLine, $this> */
    public function countLine(): BelongsTo
    {
        return $this->belongsTo(InventoryCountLine::class, 'count_line_id');
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /** @return BelongsTo<Warehouse, $this> */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    /** @return HasMany<WasteInvestigationAttachment, $this> */
    public function attachments(): HasMany
    {
        return $this->hasMany(WasteInvestigationAttachment::class, 'investigation_id')->latest();
    }

    /** @return HasMany<WasteInvestigationEvent, $this> */
    public function events(): HasMany
    {
        return $this->hasMany(WasteInvestigationEvent::class, 'investigation_id')->orderBy('occurred_at');
    }
}
