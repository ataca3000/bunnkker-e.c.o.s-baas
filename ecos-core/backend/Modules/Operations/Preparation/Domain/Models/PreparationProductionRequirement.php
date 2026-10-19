<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Operations\Preparation\Domain\Enums\ProductionRequirementStatus;

/**
 * @property string $id
 * @property string $company_id
 * @property string $preparation_wave_id
 * @property string $product_id
 * @property string $sku_snapshot
 * @property string $name_snapshot
 * @property float $quantity_required
 * @property float $quantity_available
 * @property float $quantity_to_manufacture
 * @property int $priority
 * @property string|null $manufacturing_job_id
 * @property ProductionRequirementStatus $status
 * @property \Carbon\Carbon $analyzed_at
 * @property string $created_by
 * @property string $updated_by
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class PreparationProductionRequirement extends Model
{
    use HasUuids;

    protected $table = 'preparation_production_requirements';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'preparation_wave_id',
        'product_id',
        'sku_snapshot',
        'name_snapshot',
        'quantity_required',
        'quantity_available',
        'quantity_to_manufacture',
        'priority',
        'manufacturing_job_id',
        'status',
        'analyzed_at',
        'created_by',
        'updated_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'status' => ProductionRequirementStatus::class,
            'quantity_required' => 'float',
            'quantity_available' => 'float',
            'quantity_to_manufacture' => 'float',
            'priority' => 'integer',
            'analyzed_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<PreparationWave, $this> */
    public function wave(): BelongsTo
    {
        return $this->belongsTo(PreparationWave::class, 'preparation_wave_id');
    }
}
