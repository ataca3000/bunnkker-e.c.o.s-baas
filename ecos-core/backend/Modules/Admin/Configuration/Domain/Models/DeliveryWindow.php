<?php

declare(strict_types=1);

namespace Modules\Admin\Configuration\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Organization\Brands\Domain\Models\Brand;

/**
 * @property string $id
 * @property string $brand_id
 * @property string $company_id
 * @property string $label
 * @property string $starts_at e.g. "12:00:00"
 * @property string $ends_at e.g. "15:00:00"
 * @property int $sort_order
 * @property bool $is_enabled
 */
class DeliveryWindow extends Model
{
    use HasUuids;

    protected $table = 'config_delivery_windows';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'brand_id',
        'company_id',
        'label',
        'starts_at',
        'ends_at',
        'sort_order',
        'is_enabled',
        'created_by',
        'updated_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'is_enabled' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    /** @return BelongsTo<Brand, $this> */
    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    /** Default windows for a new brand. */
    public static function defaults(): array
    {
        return [
            ['label' => '12:00 PM – 03:00 PM', 'starts_at' => '12:00:00', 'ends_at' => '15:00:00', 'sort_order' => 1],
            ['label' => '03:00 PM – 06:00 PM', 'starts_at' => '15:00:00', 'ends_at' => '18:00:00', 'sort_order' => 2],
            ['label' => '06:00 PM – 09:00 PM', 'starts_at' => '18:00:00', 'ends_at' => '21:00:00', 'sort_order' => 3],
            ['label' => '09:00 PM – 12:00 AM', 'starts_at' => '21:00:00', 'ends_at' => '00:00:00', 'sort_order' => 4],
        ];
    }
}
