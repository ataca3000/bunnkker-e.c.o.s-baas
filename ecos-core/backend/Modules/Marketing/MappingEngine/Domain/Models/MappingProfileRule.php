<?php

declare(strict_types=1);

namespace Modules\Marketing\MappingEngine\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A single matching rule within a MappingProfile.
 *
 * match_field: 'name' | 'name_contains' | 'external_id' | 'asset_type'
 * match_value: the value to compare against
 * related_type: 'company' | 'brand' | 'channel' | 'team'
 * related_id: UUID of the related ERP entity
 *
 * @property string $id
 * @property string $mapping_profile_id
 * @property string $match_field
 * @property string $match_value
 * @property string $related_type
 * @property string $related_id
 * @property int $priority
 */
class MappingProfileRule extends Model
{
    use HasUuids;

    protected $table = 'marketing_mapping_profile_rules';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'mapping_profile_id',
        'match_field',
        'match_value',
        'related_type',
        'related_id',
        'priority',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'priority' => 'integer',
        ];
    }

    /**
     * Does this rule match a given raw asset descriptor?
     *
     * @param  array{name: string, external_id: string, asset_type: string}  $asset
     */
    public function matchesData(array $asset): bool
    {
        $name = strtolower((string) ($asset['name'] ?? ''));
        $externalId = (string) ($asset['external_id'] ?? '');
        $assetType = (string) ($asset['asset_type'] ?? '');

        return match ($this->match_field) {
            'name' => $name === strtolower($this->match_value),
            'name_contains' => str_contains($name, strtolower($this->match_value)),
            'external_id' => $externalId === $this->match_value,
            'asset_type' => $assetType === $this->match_value,
            default => false,
        };
    }

    /** @return BelongsTo<MappingProfile, $this> */
    public function profile(): BelongsTo
    {
        return $this->belongsTo(MappingProfile::class, 'mapping_profile_id');
    }
}
