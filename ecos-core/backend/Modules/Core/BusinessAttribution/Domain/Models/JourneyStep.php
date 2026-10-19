<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Domain\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Core\BusinessAttribution\Domain\Enums\JourneyStage;

/**
 * Single step in a business journey — append-only, never updated.
 *
 * @property string $id
 * @property string $business_dna_id
 * @property JourneyStage $journey_stage
 * @property string|null $event_id
 * @property string|null $actor_id
 * @property string|null $actor_type
 * @property Carbon $occurred_at
 * @property int|null $duration_seconds
 * @property string|null $previous_step_id
 * @property string|null $related_entity_id
 * @property string|null $related_entity_type
 * @property array|null $payload
 * @property Carbon $created_at
 */
class JourneyStep extends Model
{
    use HasUuids;

    protected $table = 'bae_journey_steps';

    // Append-only
    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'journey_stage' => JourneyStage::class,
            'payload' => 'array',
            'occurred_at' => 'datetime',
            'created_at' => 'datetime',
            'duration_seconds' => 'integer',
        ];
    }

    public function dna(): BelongsTo
    {
        return $this->belongsTo(BusinessDna::class, 'business_dna_id');
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(BusinessEvent::class, 'event_id');
    }

    public function previousStep(): BelongsTo
    {
        return $this->belongsTo(self::class, 'previous_step_id');
    }
}
