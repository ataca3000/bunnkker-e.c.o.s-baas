<?php

declare(strict_types=1);

namespace Modules\Marketing\Initiatives\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Initiative Template — reusable preset for marketing initiatives.
 *
 * System templates (is_system = true) are shipped with ECOS and cannot be deleted.
 * Users may create custom templates.
 * Future: AI recommendation engine will suggest templates based on context.
 *
 * @property string $id
 * @property string $name
 * @property string $slug
 * @property string|null $description
 * @property string|null $category
 * @property array|null $defaults
 * @property bool $is_system
 * @property int $usage_count
 * @property string|null $created_by
 */
class MarketingInitiativeTemplate extends Model
{
    use HasUuids;

    protected $table = 'marketing_initiative_templates';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'defaults' => 'array',
            'is_system' => 'boolean',
            'usage_count' => 'integer',
        ];
    }

    /** @return HasMany<MarketingInitiative, $this> */
    public function initiatives(): HasMany
    {
        return $this->hasMany(MarketingInitiative::class, 'template_id');
    }
}
