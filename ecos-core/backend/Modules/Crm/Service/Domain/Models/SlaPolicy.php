<?php

declare(strict_types=1);

namespace Modules\Crm\Service\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/** An SLA policy — first-response and resolution targets for a priority. */
class SlaPolicy extends Model
{
    use HasUuids;

    protected $table = 'crm_service_sla_policies';

    protected $fillable = ['company_id', 'name', 'priority', 'first_response_minutes', 'resolution_minutes', 'is_default', 'is_active'];

    protected function casts(): array
    {
        return [
            'first_response_minutes' => 'integer',
            'resolution_minutes' => 'integer',
            'is_default' => 'boolean',
            'is_active' => 'boolean',
        ];
    }
}
