<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * What one revision of an offer actually said. Append-only.
 *
 * The names are stored alongside the ids deliberately. An id tells you which
 * department the offer pointed at TODAY; the name tells you what the letter said
 * on the day it was sent, and only the second one is what the candidate agreed to.
 */
class OfferVersion extends Model
{
    use HasUuids;

    protected $table = 'hr_offer_versions';

    protected $fillable = [
        'company_id', 'offer_id', 'version', 'candidate_name',
        'position_id', 'department_id', 'employment_type_id', 'branch_id',
        'position_title', 'department_name', 'branch_name', 'employment_type_name',
        'start_date', 'basic_salary', 'currency', 'notes', 'revision_reason', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'version' => 'integer',
            'start_date' => 'date',
            'basic_salary' => 'decimal:2',
        ];
    }

    public function offer(): BelongsTo
    {
        return $this->belongsTo(Offer::class, 'offer_id');
    }

    /**
     * The letter's contents, in the order they are read.
     *
     * @return array<string, mixed>
     */
    public function terms(): array
    {
        return [
            'candidate_name' => $this->candidate_name,
            'position' => $this->position_title,
            'department' => $this->department_name,
            'branch' => $this->branch_name,
            'employment_type' => $this->employment_type_name,
            'start_date' => $this->start_date?->toDateString(),
            'basic_salary' => (float) $this->basic_salary,
            'currency' => $this->currency,
            'notes' => $this->notes,
        ];
    }

    /**
     * What changed against the version before this one.
     *
     * @return array<string, array{from: mixed, to: mixed}>
     */
    public function changesAgainst(?self $previous): array
    {
        if ($previous === null) {
            return [];
        }

        $changes = [];

        foreach ($this->terms() as $field => $value) {
            $before = $previous->terms()[$field] ?? null;

            if ($before !== $value) {
                $changes[$field] = ['from' => $before, 'to' => $value];
            }
        }

        return $changes;
    }

    /** A version records what was offered at a moment. It is never rewritten. */
    protected static function booted(): void
    {
        static::updating(fn () => false);
        static::deleting(fn () => false);
    }
}
