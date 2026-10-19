<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Why an assignment cannot proceed.
 *
 * `source` records which context objected — fleet, driver, trip, capacity or
 * policy — so the board can put the right remedy next to the right blocker
 * ("find substitute" for a fleet blocker, "split trip" for a capacity one).
 */
class DispatchAssignmentBlocker extends Model
{
    public const SOURCE_FLEET = 'fleet';

    public const SOURCE_DRIVER = 'driver';

    public const SOURCE_TRIP = 'trip';

    public const SOURCE_CAPACITY = 'capacity';

    public const SOURCE_POLICY = 'policy';

    protected $table = 'dispatch_assignment_blockers';

    /** @var array<string, mixed> */
    protected $attributes = [
        'is_hard' => true,
    ];

    protected $fillable = ['assignment_id', 'source', 'reason', 'is_hard'];

    protected function casts(): array
    {
        return ['is_hard' => 'boolean'];
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(DispatchProposedAssignment::class, 'assignment_id');
    }
}
