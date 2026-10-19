<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SlaPolicy extends Model
{
    use HasUuids;

    protected $table = 'cep_sla_policies';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'first_response_minutes' => 'integer',
            'resolution_minutes' => 'integer',
            'business_hours_only' => 'boolean',
            'is_default' => 'boolean',
            'config' => 'array',
        ];
    }

    public function violations(): HasMany
    {
        return $this->hasMany(SlaViolation::class, 'sla_policy_id');
    }
}
