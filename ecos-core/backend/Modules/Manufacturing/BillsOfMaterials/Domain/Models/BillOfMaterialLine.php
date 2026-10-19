<?php

declare(strict_types=1);

namespace Modules\Manufacturing\BillsOfMaterials\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Inventory\Products\Domain\Models\Product;

final class BillOfMaterialLine extends Model
{
    use HasUuids;

    protected $table = 'bill_of_material_lines';

    protected $fillable = [
        'bom_id',
        'raw_material_id',
        'quantity',
        'waste_percentage',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'float',
            'waste_percentage' => 'float',
        ];
    }

    public function bom(): BelongsTo
    {
        return $this->belongsTo(BillOfMaterial::class, 'bom_id');
    }

    public function rawMaterial(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'raw_material_id');
    }
}
