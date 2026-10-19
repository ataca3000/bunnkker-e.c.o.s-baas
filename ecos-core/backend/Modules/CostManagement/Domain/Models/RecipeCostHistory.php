<?php

declare(strict_types=1);

namespace Modules\CostManagement\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\BillOfMaterial;

/**
 * Immutable audit record for every Recipe Cost recalculation.
 *
 * Created by CostCalculationEngine::calculateAndPersist() on every invocation.
 * trigger_type values: 'recipe_edit' | 'material_cost_update'
 */
class RecipeCostHistory extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $table = 'recipe_cost_histories';

    protected $fillable = [
        'bom_id',
        'previous_materials_cost',
        'new_materials_cost',
        'difference',
        'trigger_type',
        'trigger_source',
        'triggered_by',
        'cost_snapshot',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'previous_materials_cost' => 'float',
            'new_materials_cost' => 'float',
            'difference' => 'float',
            'cost_snapshot' => 'array',
            'occurred_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<BillOfMaterial, $this> */
    public function bom(): BelongsTo
    {
        return $this->belongsTo(BillOfMaterial::class, 'bom_id');
    }
}
