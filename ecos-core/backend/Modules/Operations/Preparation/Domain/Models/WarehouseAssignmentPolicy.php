<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;

/**
 * @property string $id
 * @property string $company_id
 * @property string|null $channel_id
 * @property string|null $governorate
 * @property string|null $zone
 * @property string $warehouse_id
 * @property int $priority
 * @property bool $is_active
 * @property string|null $notes
 * @property string|null $created_by
 * @property string|null $updated_by
 */
class WarehouseAssignmentPolicy extends Model
{
    use HasUuids;

    protected $table = 'warehouse_assignment_policies';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'channel_id',
        'governorate',
        'zone',
        'warehouse_id',
        'priority',
        'is_active',
        'notes',
        'created_by',
        'updated_by',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'is_active' => 'boolean',
        'priority' => 'integer',
    ];

    /**
     * Specificity score — used in matching. Higher is more specific.
     * channel + governorate = 3, channel only = 2, governorate only = 1, wildcard = 0.
     */
    public function specificity(): int
    {
        return ($this->channel_id !== null ? 2 : 0)
             + ($this->governorate !== null ? 1 : 0);
    }

    public function channel(): BelongsTo
    {
        return $this->belongsTo(Channel::class);
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }
}
