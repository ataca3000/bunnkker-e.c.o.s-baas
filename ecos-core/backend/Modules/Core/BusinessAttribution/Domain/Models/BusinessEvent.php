<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Core\BusinessAttribution\Domain\Enums\EventCategory;

/**
 * Immutable business event record — append-only, never updated.
 *
 * @property string $id
 * @property string $event_uuid
 * @property string $event_name
 * @property EventCategory $category
 * @property string $producer_module
 * @property string $producer_entity
 * @property string|null $entity_id
 * @property string|null $entity_type
 * @property string|null $company_id
 * @property string|null $brand_id
 * @property string|null $channel_id
 * @property string|null $warehouse_id
 * @property string|null $business_unit
 * @property string|null $cost_center
 * @property string|null $actor_id
 * @property string|null $actor_type
 * @property \Carbon\Carbon $occurred_at
 * @property string|null $correlation_id
 * @property string|null $business_dna_id
 * @property array $payload
 * @property array|null $metadata
 * @property string $version
 * @property \Carbon\Carbon $created_at
 */
class BusinessEvent extends Model
{
    use HasUuids;

    protected $table = 'bae_business_events';

    // Append-only — no updated_at
    public $timestamps = false;

    protected $attributes = ['version' => '1.0'];

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'category' => EventCategory::class,
            'payload' => 'array',
            'metadata' => 'array',
            'occurred_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function dna(): BelongsTo
    {
        return $this->belongsTo(BusinessDna::class, 'business_dna_id');
    }
}
