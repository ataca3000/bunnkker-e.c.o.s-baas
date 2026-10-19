<?php

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class RepairRetryPolicy extends Model
{
    use HasUuids;

    protected $table = 'engineering_repair_retry_policies';

    protected $fillable = [
        'company_id',
        'name',
        'failure_type',
        'max_retries',
        'retry_delay_seconds',
        'backoff_multiplier',
        'timeout_seconds',
        'is_default',
        'is_active',
    ];

    public function casts(): array
    {
        return [
            'max_retries'         => 'integer',
            'retry_delay_seconds' => 'integer',
            'backoff_multiplier'  => 'float',
            'timeout_seconds'     => 'integer',
            'is_default'          => 'boolean',
            'is_active'           => 'boolean',
        ];
    }
}
