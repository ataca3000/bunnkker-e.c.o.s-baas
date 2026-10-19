<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * @property string $id
 * @property string $company_id
 * @property string $warehouse_id
 * @property string $collection_start_time e.g. "06:00:00"
 * @property string $preparation_start_time e.g. "09:00:00"
 * @property string $wave_end_time e.g. "18:00:00"
 * @property bool $auto_create
 * @property bool $auto_assign_orders
 * @property bool $auto_move_to_preparing
 * @property string[] $eligible_order_statuses
 * @property string $timezone
 * @property bool $is_active
 * @property string $created_by
 * @property string $updated_by
 */
class WaveEngineConfiguration extends Model
{
    use HasUuids;

    protected $table = 'wave_engine_configurations';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'warehouse_id',
        'collection_start_time',
        'preparation_start_time',
        'wave_end_time',
        'auto_create',
        'auto_assign_orders',
        'auto_move_to_preparing',
        'eligible_order_statuses',
        'timezone',
        'is_active',
        'created_by',
        'updated_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'auto_create' => 'boolean',
            'auto_assign_orders' => 'boolean',
            'auto_move_to_preparing' => 'boolean',
            'eligible_order_statuses' => 'array',
            'is_active' => 'boolean',
        ];
    }
}
