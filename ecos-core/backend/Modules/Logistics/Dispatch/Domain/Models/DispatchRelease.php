<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * The act of committing an assignment in V1.
 *
 * v1_trip_id and v1_assignment_id are the RECEIPTS returned by Distribution's
 * TripService and Drivers' DriverVehicleAssignmentService. They make
 * "Dispatch went through V1 rather than around it" auditable in the data, not
 * merely a claim about the code.
 */
class DispatchRelease extends Model
{
    protected $table = 'dispatch_releases';

    /** @var array<string, mixed> */
    protected $attributes = [
        'succeeded' => false,
    ];

    protected $fillable = [
        'uuid', 'dispatch_proposal_id', 'assignment_id', 'succeeded',
        'v1_trip_id', 'v1_assignment_id', 'failure_reason',
        'released_at', 'released_by',
    ];

    protected function casts(): array
    {
        return [
            'succeeded' => 'boolean',
            'released_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $release): void {
            if ($release->uuid === null) {
                $release->uuid = (string) Str::uuid();
            }

            if ($release->released_at === null) {
                $release->released_at = now();
            }
        });
    }

    public function proposal(): BelongsTo
    {
        return $this->belongsTo(DispatchProposal::class, 'dispatch_proposal_id');
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(DispatchProposedAssignment::class, 'assignment_id');
    }

    /** True once V1 confirmed the pairing. */
    public function isCommittedInV1(): bool
    {
        return $this->succeeded && $this->v1_assignment_id !== null;
    }
}
