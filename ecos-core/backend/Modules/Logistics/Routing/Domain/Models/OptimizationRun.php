<?php

declare(strict_types=1);

namespace Modules\Logistics\Routing\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * An immutable audit of one optimisation.
 *
 * request_snapshot holds the exact input the strategy saw. That single decision
 * is what makes a run replayable, a regression debuggable, and a future AI
 * strategy a drop-in — it accumulates a corpus of (problem, chosen solution)
 * pairs from day one, at negligible cost, purely as a by-product of running the
 * business.
 */
class OptimizationRun extends Model
{
    protected $table = 'routing_optimization_runs';

    /** @var array<string, mixed> */
    protected $attributes = [
        'succeeded' => true,
        'stop_count' => 0,
    ];

    protected $fillable = [
        'uuid', 'route_plan_id', 'company_id', 'strategy', 'strategy_version',
        'succeeded', 'failure_reason', 'request_snapshot', 'proposal_summary',
        'constraint_violations', 'duration_ms', 'stop_count', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'succeeded' => 'boolean',
            'request_snapshot' => 'array',
            'proposal_summary' => 'array',
            'constraint_violations' => 'array',
            'duration_ms' => 'integer',
            'stop_count' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $run): void {
            if ($run->uuid === null) {
                $run->uuid = (string) Str::uuid();
            }
        });
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(RoutePlan::class, 'route_plan_id');
    }

    /** @return list<string> */
    public function violations(): array
    {
        return $this->constraint_violations ?? [];
    }

    public function isReplayable(): bool
    {
        return ! empty($this->request_snapshot);
    }
}
