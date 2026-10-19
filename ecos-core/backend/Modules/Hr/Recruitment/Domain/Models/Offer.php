<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Modules\Hr\Recruitment\Domain\Enums\OfferStatus;

/**
 * An offer of employment — the commitment, not the terms.
 *
 * The terms are on the versions. This row is the identity, the status, and the
 * dates that decide whether it still stands.
 */
class Offer extends Model
{
    use HasUuids;

    protected $table = 'hr_offers';

    protected $fillable = [
        'company_id', 'application_id', 'applicant_id', 'offer_number', 'status',
        'current_version', 'expires_on', 'sent_at', 'responded_at', 'response_note',
        'withdrawn_at', 'created_by', 'sent_by',
    ];

    protected function casts(): array
    {
        return [
            'status' => OfferStatus::class,
            'current_version' => 'integer',
            'expires_on' => 'date',
            'sent_at' => 'datetime',
            'responded_at' => 'datetime',
            'withdrawn_at' => 'datetime',
        ];
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(JobApplication::class, 'application_id');
    }

    public function applicant(): BelongsTo
    {
        return $this->belongsTo(Applicant::class, 'applicant_id');
    }

    public function versions(): HasMany
    {
        return $this->hasMany(OfferVersion::class, 'offer_id')->orderBy('version');
    }

    /** The terms currently on the table. */
    public function currentTerms(): ?OfferVersion
    {
        return $this->versions()->where('version', $this->current_version)->first();
    }

    /**
     * Past its expiry date and still unanswered.
     *
     * Derived rather than stored, so an offer is never briefly "live" because a
     * nightly job has not run yet. The service persists the status separately for
     * reporting; this is what actually decides.
     */
    public function hasLapsed(): bool
    {
        if (! $this->status->isOpen() || $this->expires_on === null) {
            return false;
        }

        return $this->expires_on->endOfDay()->isPast();
    }

    /** Hiring is permitted only from here. */
    public function permitsHiring(): bool
    {
        return $this->status->permitsHiring();
    }

    public function scopeOpen(Builder $query): Builder
    {
        return $query->whereIn('status', [OfferStatus::Draft->value, OfferStatus::Sent->value]);
    }

    /** Sent, unanswered, and past its date — what the expiry sweep collects. */
    public function scopeLapsed(Builder $query): Builder
    {
        return $query->where('status', OfferStatus::Sent->value)
            ->whereNotNull('expires_on')
            ->whereDate('expires_on', '<', Carbon::now()->toDateString());
    }
}
