<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One band of a tiered commission rule. */
class CommissionRuleTier extends Model
{
    use HasUuids;

    protected $table = 'hr_commission_rule_tiers';

    protected $fillable = ['rule_id', 'from_value', 'to_value', 'rate', 'sequence'];

    protected function casts(): array
    {
        return [
            'from_value' => 'decimal:4',
            'to_value' => 'decimal:4',
            'rate' => 'decimal:4',
            'sequence' => 'integer',
        ];
    }

    public function rule(): BelongsTo
    {
        return $this->belongsTo(CommissionRule::class, 'rule_id');
    }

    /** Does an achieved value fall in this band? The top tier is open-ended. */
    public function covers(float $value): bool
    {
        if ($value < (float) $this->from_value) {
            return false;
        }

        return $this->to_value === null || $value <= (float) $this->to_value;
    }
}
