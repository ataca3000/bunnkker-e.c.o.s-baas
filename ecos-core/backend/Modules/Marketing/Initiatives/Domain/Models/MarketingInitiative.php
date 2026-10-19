<?php

declare(strict_types=1);

namespace Modules\Marketing\Initiatives\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Marketing\Campaigns\Domain\Enums\BusinessGoal;
use Modules\Marketing\Campaigns\Domain\Enums\Season;
use Modules\Marketing\Campaigns\Domain\Models\Campaign;
use Modules\Marketing\Initiatives\Domain\Enums\InitiativeStatus;

/**
 * Marketing Initiative — ERP Business Entity.
 *
 * Sits ABOVE Campaigns in the hierarchy:
 *   Initiative → Campaign → Ad Set → Ad → Creative
 *
 * This entity is 100% ECOS-owned.
 * It is NEVER synchronized with Meta.
 * It is NEVER sent to Meta.
 * It is the primary entity for executive reporting, marketing finance,
 * budget planning, and strategic intelligence.
 *
 * @property string $id
 * @property string|null $company_id
 * @property string|null $brand_id
 * @property string|null $channel_id
 * @property string|null $template_id
 * @property string $name
 * @property string|null $description
 * @property InitiativeStatus $status
 * @property string|null $business_unit
 * @property Season|null $season
 * @property BusinessGoal|null $business_goal
 * @property string|null $cost_center
 * @property float|null $budget
 * @property string $currency
 * @property \Carbon\Carbon|null $start_date
 * @property \Carbon\Carbon|null $end_date
 * @property string|null $owner_id
 * @property string|null $marketing_team
 * @property string|null $internal_notes
 * @property array|null $tags
 * @property string|null $created_by
 * @property string|null $updated_by
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class MarketingInitiative extends Model
{
    use HasUuids;

    protected $table = 'marketing_initiatives';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'status' => InitiativeStatus::class,
            'season' => Season::class,
            'business_goal' => BusinessGoal::class,
            'budget' => 'decimal:2',
            'start_date' => 'date',
            'end_date' => 'date',
            'tags' => 'array',
        ];
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public function isActive(): bool
    {
        return $this->status === InitiativeStatus::Active;
    }

    public function isOnSchedule(): bool
    {
        $today = now()->toDateString();

        return $this->start_date !== null
            && $this->end_date !== null
            && $today >= $this->start_date->toDateString()
            && $today <= $this->end_date->toDateString();
    }

    public function daysRemaining(): ?int
    {
        if ($this->end_date === null) {
            return null;
        }

        return max(0, (int) now()->diffInDays($this->end_date, false));
    }

    public function progressPercent(): ?float
    {
        if ($this->start_date === null || $this->end_date === null) {
            return null;
        }
        $total = $this->start_date->diffInDays($this->end_date);
        $elapsed = $this->start_date->diffInDays(now(), false);
        if ($total <= 0) {
            return 100.0;
        }

        return round(min(100.0, max(0.0, ($elapsed / $total) * 100)), 1);
    }

    // ── Relationships ─────────────────────────────────────────────────────────

    /** @return HasMany<Campaign, $this> */
    public function campaigns(): HasMany
    {
        return $this->hasMany(Campaign::class, 'marketing_initiative_id');
    }

    /** @return BelongsTo<MarketingInitiativeTemplate, $this> */
    public function template(): BelongsTo
    {
        return $this->belongsTo(MarketingInitiativeTemplate::class, 'template_id');
    }
}
