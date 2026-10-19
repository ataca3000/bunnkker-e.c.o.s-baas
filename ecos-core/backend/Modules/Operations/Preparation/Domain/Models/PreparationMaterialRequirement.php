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
 * @property string $raw_material_id
 * @property string $material_name_snapshot
 * @property string $unit_snapshot
 * @property float $quantity_required
 * @property float $quantity_available
 * @property float $quantity_to_purchase
 * @property bool $shortage
 * @property float $shortage_amount
 * @property \Carbon\Carbon $analyzed_at
 * @property string $analyzed_by
 * @property string|null $purchase_request_id
 * @property bool $resolved
 * @property \Carbon\Carbon|null $resolved_at
 * @property string|null $resolved_by
 * @property string $created_by
 * @property string $updated_by
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class PreparationMaterialRequirement extends Model
{
    use HasUuids;

    protected $table = 'preparation_material_requirements';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'preparation_wave_id',
        'raw_material_id',
        'material_name_snapshot',
        'unit_snapshot',
        'quantity_required',
        'quantity_available',
        'quantity_to_purchase',
        'shortage',
        'shortage_amount',
        'analyzed_at',
        'analyzed_by',
        'purchase_request_id',
        'resolved',
        'resolved_at',
        'resolved_by',
        'created_by',
        'updated_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'quantity_required' => 'float',
            'quantity_available' => 'float',
            'quantity_to_purchase' => 'float',
            'shortage' => 'boolean',
            'shortage_amount' => 'float',
            'resolved' => 'boolean',
            'analyzed_at' => 'datetime',
            'resolved_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<PreparationWave, $this> */
    public function wave(): BelongsTo
    {
        return $this->belongsTo(PreparationWave::class, 'preparation_wave_id');
    }
}
