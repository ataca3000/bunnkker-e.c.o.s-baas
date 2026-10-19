<?php

declare(strict_types=1);

namespace Modules\Inventory\CountSessions\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Inventory\CountSessions\Domain\Enums\CountSessionStatus;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Companies\Domain\Models\Company;

/**
 * @property string $id
 * @property string $company_id
 * @property string $warehouse_id
 * @property string $count_number
 * @property CountSessionStatus $status
 * @property \Illuminate\Support\Carbon|null $started_at
 * @property \Illuminate\Support\Carbon|null $completed_at
 * @property string|null $notes
 * @property string|null $created_by
 * @property string|null $approved_by
 */
class InventoryCountSession extends Model
{
    use HasUuids;

    protected $table = 'inventory_count_sessions';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'warehouse_id',
        'count_number',
        'status',
        'started_at',
        'completed_at',
        'notes',
        'created_by',
        'approved_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'status' => CountSessionStatus::class,
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Company, $this> */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /** @return BelongsTo<Warehouse, $this> */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    /** @return HasMany<InventoryCountLine, $this> */
    public function lines(): HasMany
    {
        return $this->hasMany(InventoryCountLine::class, 'session_id');
    }
}
