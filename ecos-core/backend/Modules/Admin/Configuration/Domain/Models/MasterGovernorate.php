<?php

declare(strict_types=1);

namespace Modules\Admin\Configuration\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Permanent Egypt master geography record — one row per governorate.
 * Not brand-specific. Seeded once by EgyptMasterGeographySeeder.
 *
 * @property string $id
 * @property string $name
 * @property string|null $name_ar
 * @property string $code
 * @property int $sort_order
 * @property bool $is_active
 * @property bool $is_archived
 */
class MasterGovernorate extends Model
{
    use HasUuids;

    protected $table = 'master_governorates';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'name',
        'name_ar',
        'code',
        'sort_order',
        'is_active',
        'is_archived',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'is_active' => 'boolean',
            'is_archived' => 'boolean',
        ];
    }

    /** @return HasMany<MasterZone, $this> */
    public function zones(): HasMany
    {
        return $this->hasMany(MasterZone::class, 'master_governorate_id')
            ->orderBy('sort_order');
    }

    /** @return HasMany<DeliveryGeography, $this> */
    public function brandGeographies(): HasMany
    {
        return $this->hasMany(DeliveryGeography::class, 'master_governorate_id');
    }
}
