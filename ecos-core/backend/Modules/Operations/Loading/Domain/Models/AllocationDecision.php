<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $company_id
 * @property string $allocation_record_id
 * @property int $revision_number
 * @property string $actor_type
 * @property string|null $actor_id
 * @property float $quantity_before
 * @property float $quantity_after
 * @property string $reason
 * @property string|null $policy_evaluation_id
 * @property \Carbon\Carbon $recorded_at
 */
class AllocationDecision extends Model
{
    protected $table = 'allocation_decisions';

    public $incrementing = false;

    protected $keyType = 'string';

    public $timestamps = false;

    /** @var list<string> */
    protected $fillable = [
        'id',
        'company_id',
        'allocation_record_id',
        'revision_number',
        'actor_type',
        'actor_id',
        'quantity_before',
        'quantity_after',
        'reason',
        'policy_evaluation_id',
        'recorded_at',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'revision_number' => 'integer',
            'quantity_before' => 'float',
            'quantity_after' => 'float',
            'recorded_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<AllocationRecord, $this> */
    public function allocationRecord(): BelongsTo
    {
        return $this->belongsTo(AllocationRecord::class, 'allocation_record_id');
    }
}
