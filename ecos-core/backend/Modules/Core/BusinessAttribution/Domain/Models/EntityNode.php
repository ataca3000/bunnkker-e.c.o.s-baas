<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Domain\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Core\BusinessAttribution\Domain\Enums\NodeType;

/**
 * A node in the Business Graph Layer.
 *
 * @property string $id
 * @property NodeType $node_type
 * @property string $entity_id
 * @property string $entity_type
 * @property string|null $company_id
 * @property string|null $label
 * @property array|null $properties
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
class EntityNode extends Model
{
    use HasUuids;

    protected $table = 'bae_entity_nodes';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'node_type' => NodeType::class,
            'properties' => 'array',
        ];
    }

    public function outgoingRelationships(): HasMany
    {
        return $this->hasMany(EntityRelationship::class, 'from_node_id');
    }

    public function incomingRelationships(): HasMany
    {
        return $this->hasMany(EntityRelationship::class, 'to_node_id');
    }
}
