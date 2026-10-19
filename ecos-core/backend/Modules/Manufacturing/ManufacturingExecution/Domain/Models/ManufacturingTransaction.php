<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingExecution\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Modules\Manufacturing\ManufacturingExecution\Domain\Enums\TransactionStatus;

/**
 * Persistent record of a completed manufacturing execution.
 *
 * Idempotency anchor: UNIQUE(plan_id) ensures each ManufacturingPlan
 * can only produce one successful transaction.
 *
 * RC-10: UNIQUE(order_line_id, bom_id, bom_version_number) WHERE status != 'failed'
 * is enforced at the DB level once order_line_id is populated (Order integration — future).
 *
 * @property string $id
 * @property string $execution_id
 * @property string|null $decision_key
 * @property string|null $correlation_id
 * @property string $plan_id
 * @property string $product_id
 * @property string $warehouse_id
 * @property string|null $bom_id
 * @property int|null $bom_version_number
 * @property string|null $recipe_snapshot_hash
 * @property numeric-string $qty_produced
 * @property TransactionStatus $status
 * @property string $executed_at
 * @property int|null $duration_ms
 * @property string|null $order_line_id
 * @property array|null $metadata
 */
class ManufacturingTransaction extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $table = 'manufacturing_transactions';

    /** @var list<string> */
    protected $fillable = [
        'execution_id',
        'decision_key',
        'correlation_id',
        'plan_id',
        'product_id',
        'warehouse_id',
        'bom_id',
        'bom_version_number',
        'recipe_snapshot_hash',
        'qty_produced',
        'status',
        'executed_at',
        'duration_ms',
        'order_line_id',
        'metadata',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'status' => TransactionStatus::class,
            'qty_produced' => 'decimal:4',
            'metadata' => 'array',
        ];
    }
}
