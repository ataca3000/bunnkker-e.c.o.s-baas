<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $company_id
 * @property string $preparation_wave_id
 * @property string $order_id
 * @property string $order_number
 * @property \Carbon\Carbon $order_confirmed_at
 * @property string|null $customer_name_snapshot
 * @property string|null $delivery_zone_snapshot
 * @property string|null $delivery_window_id
 * @property string|null $delivery_window_label
 * @property string|null $delivery_window_starts_at
 * @property string|null $delivery_window_ends_at
 * @property string|null $governorate_snapshot
 * @property string|null $master_governorate_id
 * @property string|null $zone_code_snapshot
 * @property string|null $master_zone_id
 * @property float|null $shipping_cost_snapshot
 * @property int $preparation_priority
 * @property bool $is_paid
 * @property \Carbon\Carbon $added_at
 * @property string $added_by
 */
class PreparationWaveOrder extends Model
{
    use HasUuids;

    protected $table = 'preparation_wave_orders';

    public $incrementing = false;

    protected $keyType = 'string';

    public $timestamps = false;

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'preparation_wave_id',
        'order_id',
        'order_number',
        'order_confirmed_at',
        'customer_name_snapshot',
        'delivery_zone_snapshot',
        'delivery_window_id',
        'delivery_window_label',
        'delivery_window_starts_at',
        'delivery_window_ends_at',
        'governorate_snapshot',
        'master_governorate_id',
        'zone_code_snapshot',
        'master_zone_id',
        'shipping_cost_snapshot',
        'preparation_priority',
        'is_paid',
        'added_at',
        'added_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'order_confirmed_at' => 'datetime',
            'added_at' => 'datetime',
            'shipping_cost_snapshot' => 'decimal:2',
            'preparation_priority' => 'integer',
            'is_paid' => 'boolean',
        ];
    }

    /** @return BelongsTo<PreparationWave, $this> */
    public function wave(): BelongsTo
    {
        return $this->belongsTo(PreparationWave::class, 'preparation_wave_id');
    }
}
