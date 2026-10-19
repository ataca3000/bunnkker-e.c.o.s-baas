<?php

declare(strict_types=1);

namespace Modules\Crm\Sales\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Crm\Sales\Domain\Enums\OpportunityStatus;

/** A deal in the pipeline. Winning it references the resulting order by opaque id. */
class Opportunity extends Model
{
    use HasUuids;

    protected $table = 'crm_opportunities';

    protected $fillable = [
        'company_id', 'customer_id', 'lead_id', 'pipeline_id', 'stage_id', 'name', 'amount', 'currency',
        'probability', 'expected_close_date', 'status', 'source', 'lost_reason', 'won_at', 'lost_at',
        'order_reference', 'tags', 'owner_id', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'status' => OpportunityStatus::class,
            'amount' => 'decimal:2',
            'probability' => 'integer',
            'expected_close_date' => 'date',
            'won_at' => 'datetime',
            'lost_at' => 'datetime',
            'tags' => 'array',
        ];
    }

    public function stage(): BelongsTo
    {
        return $this->belongsTo(PipelineStage::class, 'stage_id');
    }

    /** Expected value weighted by probability — the forecast contribution. */
    public function weightedValue(): float
    {
        return round((float) $this->amount * ($this->probability / 100), 2);
    }
}
