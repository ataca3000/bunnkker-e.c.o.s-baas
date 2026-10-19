<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Modules\Hr\Compensation\Domain\Enums\CommissionMethod;
use Modules\Hr\Compensation\Domain\Enums\CommissionScope;

/** A configured commission scheme: which metric, which method, what rate, for whom. */
class CommissionRule extends Model
{
    use HasUuids;

    protected $table = 'hr_commission_rules';

    /**
     * The fields that decide what a rule PAYS.
     *
     * Changing any of them changes what historical payroll would recalculate to,
     * so they are versioned rather than edited (Part 8). Everything outside this
     * list — the name, the description, the priority — is presentation or
     * ordering, and can be corrected in place without moving a single figure.
     */
    public const ECONOMIC_FIELDS = [
        'metric_key', 'method', 'rate', 'applies_to', 'target_id',
        'dimension_key', 'dimension_value',
        'min_amount', 'max_amount', 'threshold_value', 'tiers',
    ];

    protected $fillable = [
        'company_id', 'code', 'name', 'description', 'metric_key', 'method', 'rate',
        'applies_to', 'target_id', 'dimension_key', 'dimension_value',
        'min_amount', 'max_amount', 'threshold_value',
        'effective_from', 'effective_to', 'priority', 'is_active',
        // Part 8 — the lineage.
        'version', 'version_group', 'supersedes_rule_id', 'superseded_at',
    ];

    protected function casts(): array
    {
        return [
            'method' => CommissionMethod::class,
            'applies_to' => CommissionScope::class,
            'rate' => 'decimal:4',
            'min_amount' => 'decimal:2',
            'max_amount' => 'decimal:2',
            'threshold_value' => 'decimal:4',
            'effective_from' => 'date',
            'effective_to' => 'date',
            'priority' => 'integer',
            'is_active' => 'boolean',
            'version' => 'integer',
            'superseded_at' => 'datetime',
        ];
    }

    /** Every version of this rule, oldest first. */
    public function lineage(): HasMany
    {
        return $this->hasMany(self::class, 'version_group', 'version_group')->orderBy('version');
    }

    /** The version this one replaced. */
    public function predecessor(): ?self
    {
        return $this->supersedes_rule_id === null
            ? null
            : self::query()->find($this->supersedes_rule_id);
    }

    /** Has a later version taken over? */
    public function isSuperseded(): bool
    {
        return $this->superseded_at !== null;
    }

    /**
     * The current version of a lineage — the one a new change would build on.
     *
     * Highest version rather than "not superseded", so it stays right even if a
     * lineage is ever left without a closing timestamp.
     */
    public function scopeLatestOfLineage(Builder $query, string $versionGroup): Builder
    {
        return $query->where('version_group', $versionGroup)->orderByDesc('version')->limit(1);
    }

    public function tiers(): HasMany
    {
        return $this->hasMany(CommissionRuleTier::class, 'rule_id')->orderBy('sequence');
    }

    /** Rules live on a date — an expired scheme never pays. */
    public function scopeEffectiveOn(Builder $query, string $date): Builder
    {
        return $query->where('is_active', true)
            ->where(fn ($q) => $q->whereNull('effective_from')->orWhere('effective_from', '<=', $date))
            ->where(fn ($q) => $q->whereNull('effective_to')->orWhere('effective_to', '>=', $date));
    }

    public function isEffectiveOn(Carbon $date): bool
    {
        if (! $this->is_active) {
            return false;
        }

        if ($this->effective_from !== null && $date->lessThan($this->effective_from)) {
            return false;
        }

        return ! ($this->effective_to !== null && $date->greaterThan($this->effective_to));
    }
}
