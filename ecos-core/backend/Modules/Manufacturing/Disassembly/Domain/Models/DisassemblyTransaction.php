<?php

declare(strict_types=1);

namespace Modules\Manufacturing\Disassembly\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Modules\Manufacturing\ManufacturingExecution\Domain\Enums\TransactionStatus;

/**
 * Persistent record of a completed disassembly execution.
 *
 * Idempotency anchors:
 *   - UNIQUE(plan_id)          — prevents double-execution of the same plan (technical guard).
 *   - UNIQUE(trigger_id) WHERE trigger_id IS NOT NULL AND status != 'failed'
 *                              — prevents double-disassembly of the same return line (business guard).
 *
 * @property string $id
 * @property string $execution_id
 * @property string $plan_id
 * @property string|null $trigger_id
 * @property string $product_id
 * @property string $warehouse_id
 * @property string|null $bom_id
 * @property int|null $bom_version_number
 * @property string|null $recipe_snapshot_hash
 * @property numeric-string $qty_disassembled
 * @property TransactionStatus $status
 * @property string $executed_at
 * @property int|null $duration_ms
 * @property array|null $metadata
 */
class DisassemblyTransaction extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $table = 'disassembly_transactions';

    /** @var list<string> */
    protected $fillable = [
        'execution_id',
        'plan_id',
        'trigger_id',
        'product_id',
        'warehouse_id',
        'bom_id',
        'bom_version_number',
        'recipe_snapshot_hash',
        'qty_disassembled',
        'status',
        'executed_at',
        'duration_ms',
        'metadata',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'status' => TransactionStatus::class,
            'qty_disassembled' => 'decimal:4',
            'metadata' => 'array',
        ];
    }
}
