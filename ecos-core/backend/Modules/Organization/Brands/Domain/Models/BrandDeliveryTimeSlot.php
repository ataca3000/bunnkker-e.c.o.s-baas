<?php

declare(strict_types=1);

namespace Modules\Organization\Brands\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $brand_id
 * @property string $name Customer-visible label, e.g. "09:00 AM – 12:00 PM"
 * @property string $start_time "HH:MM:SS"
 * @property string $end_time "HH:MM:SS"
 * @property int $display_order
 * @property bool $is_active
 * @property array|null $available_days
 * @property string|null $cutoff_time
 */
class BrandDeliveryTimeSlot extends Model
{
    use HasUuids;

    protected $table = 'brand_delivery_time_slots';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'brand_id',
        'name',
        'start_time',
        'end_time',
        'display_order',
        'is_active',
        'available_days',
        'cutoff_time',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'display_order' => 'integer',
            'available_days' => 'array',
        ];
    }

    /** @return BelongsTo<Brand, $this> */
    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    /** Default slots shown to any new brand. */
    public static function defaults(): array
    {
        return [
            ['name' => '09:00 AM – 12:00 PM', 'start_time' => '09:00:00', 'end_time' => '12:00:00', 'display_order' => 1],
            ['name' => '12:00 PM – 03:00 PM', 'start_time' => '12:00:00', 'end_time' => '15:00:00', 'display_order' => 2],
            ['name' => '03:00 PM – 06:00 PM', 'start_time' => '15:00:00', 'end_time' => '18:00:00', 'display_order' => 3],
            ['name' => '06:00 PM – 09:00 PM', 'start_time' => '18:00:00', 'end_time' => '21:00:00', 'display_order' => 4],
        ];
    }
}
