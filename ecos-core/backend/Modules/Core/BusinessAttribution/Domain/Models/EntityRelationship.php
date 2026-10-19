<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Domain\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Core\BusinessAttribution\Domain\Enums\RelationshipType;

/**
 * An edge in the Business Graph Layer — immutable, append-only.
 *
 * @property string $id
 * @property string $from_node_id
 * @property string $to_node_id
 * @property RelationshipType $relationship_type
 * @property float|null $weight
 * @property array|null $properties
 * @property Carbon $created_at
 */
class EntityRelationship extends Model
{
    use HasUuids;

    protected $table = 'bae_entity_relationships';

    // Append-only — no updated_at
    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'relationship_type' => RelationshipType::class,
            'properties' => 'array',
            'weight' => 'float',
            'created_at' => 'datetime',
        ];
    }

    public function fromNode(): BelongsTo
    {
        return $this->belongsTo(EntityNode::class, 'from_node_id');
    }

    public function toNode(): BelongsTo
    {
        return $this->belongsTo(EntityNode::class, 'to_node_id');
    }
}
