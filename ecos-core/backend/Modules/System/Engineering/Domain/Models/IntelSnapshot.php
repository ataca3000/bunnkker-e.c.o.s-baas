<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Model;

class IntelSnapshot extends Model
{
    protected $table = 'engineering_intel_snapshots';

    public $timestamps = false;

    public $incrementing = true;

    protected $keyType = 'int';

    protected $fillable = [
        'company_id',
        'snapshot_type',
        'period_label',
        'metrics',
        'recorded_at',
    ];

    protected function casts(): array
    {
        return [
            'metrics'     => 'array',
            'recorded_at' => 'datetime',
        ];
    }
}
