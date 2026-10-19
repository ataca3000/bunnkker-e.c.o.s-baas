<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * @property string $id
 * @property string $company_id
 * @property string|null $warehouse_id null = applies to all company warehouses
 * @property string $auto_create_time e.g. "06:00:00"
 * @property string|null $freeze_time e.g. "14:00:00"; null = no auto-freeze
 * @property string|null $auto_close_time e.g. "23:59:00"; null = manual close
 * @property array $eligible_order_statuses
 * @property bool $auto_attach_orders
 * @property bool $auto_recalculate_demand
 * @property bool $is_active
 * @property string|null $created_by
 * @property string|null $updated_by
 */
class PreparationSessionPolicy extends Model
{
    use HasUuids;

    protected $table = 'preparation_session_policies';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'warehouse_id',
        'auto_create_time',
        'freeze_time',
        'auto_close_time',
        'eligible_order_statuses',
        'auto_attach_orders',
        'auto_recalculate_demand',
        'is_active',
        'created_by',
        'updated_by',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'eligible_order_statuses' => 'array',
        'auto_attach_orders' => 'boolean',
        'auto_recalculate_demand' => 'boolean',
        'is_active' => 'boolean',
    ];

    /**
     * Returns the default statuses when no policy exists.
     *
     * @return list<string>
     */
    public static function defaultEligibleStatuses(): array
    {
        return ['confirm_order', 'in_progress'];
    }
}
