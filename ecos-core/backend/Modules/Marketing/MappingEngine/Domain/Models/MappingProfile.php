<?php

declare(strict_types=1);

namespace Modules\Marketing\MappingEngine\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Reusable mapping profile that groups rules for auto-mapping new assets.
 *
 * @property string $id
 * @property string|null $company_id
 * @property string $name
 * @property string|null $description
 * @property string|null $connector_type null = applies to all connectors
 * @property bool $is_active
 * @property bool $auto_apply automatically apply when new assets are discovered
 * @property string|null $created_by
 */
class MappingProfile extends Model
{
    use HasUuids;

    protected $table = 'marketing_mapping_profiles';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'name',
        'description',
        'connector_type',
        'is_active',
        'auto_apply',
        'created_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'auto_apply' => 'boolean',
        ];
    }

    /** @return HasMany<MappingProfileRule, $this> */
    public function rules(): HasMany
    {
        return $this->hasMany(MappingProfileRule::class, 'mapping_profile_id')
            ->orderByDesc('priority');
    }
}
