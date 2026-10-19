<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use Modules\Logistics\Dispatch\Domain\Enums\AssignmentStatus;
use Modules\Logistics\Dispatch\Domain\Enums\ProposalStatus;

/**
 * A generated set of assignments. Immutable once decided.
 *
 * pool_snapshot records the resources the proposal was computed against, so a
 * decision stays explainable weeks later — the same snapshot-in / proposal-out
 * discipline Routing uses.
 */
class DispatchProposal extends Model
{
    protected $table = 'dispatch_proposals';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => ProposalStatus::Generated->value,
        'assignment_count' => 0,
        'blocked_count' => 0,
    ];

    protected $fillable = [
        'uuid', 'dispatch_board_id', 'dispatch_policy_id', 'company_id',
        'status', 'assignment_count', 'blocked_count', 'pool_snapshot',
        'decided_at', 'decided_by', 'decision_reason', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'status' => ProposalStatus::class,
            'assignment_count' => 'integer',
            'blocked_count' => 'integer',
            'pool_snapshot' => 'array',
            'decided_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $proposal): void {
            if ($proposal->uuid === null) {
                $proposal->uuid = (string) Str::uuid();
            }
        });
    }

    public function board(): BelongsTo
    {
        return $this->belongsTo(DispatchBoard::class, 'dispatch_board_id');
    }

    public function policy(): BelongsTo
    {
        return $this->belongsTo(DispatchPolicy::class, 'dispatch_policy_id');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(DispatchProposedAssignment::class, 'dispatch_proposal_id');
    }

    public function releases(): HasMany
    {
        return $this->hasMany(DispatchRelease::class, 'dispatch_proposal_id');
    }

    public function isDecided(): bool
    {
        return $this->status->isDecided();
    }

    /** Assignments the release pass will actually attempt. */
    public function releasableAssignments(): HasMany
    {
        return $this->assignments()->whereIn('status', [
            AssignmentStatus::Proposed->value,
            AssignmentStatus::Overridden->value,
        ]);
    }
}
