<?php

declare(strict_types=1);

namespace Modules\Crm\Intelligence\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Crm\Customers\Domain\Models\Customer;
use Modules\Crm\Intelligence\Domain\Enums\RecommendationType;

/** A deterministic, rule-based next-best-action for a customer. */
class CustomerRecommendation extends Model
{
    use HasUuids;

    protected $table = 'crm_customer_recommendations';

    protected $fillable = [
        'company_id', 'customer_id', 'type', 'rule_key', 'title',
        'rationale', 'priority', 'status', 'context', 'generated_at',
    ];

    protected function casts(): array
    {
        return [
            'type' => RecommendationType::class,
            'priority' => 'integer',
            'context' => 'array',
            'generated_at' => 'datetime',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }
}
