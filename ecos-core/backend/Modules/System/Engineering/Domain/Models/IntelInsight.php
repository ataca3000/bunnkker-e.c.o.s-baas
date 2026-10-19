<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class IntelInsight extends Model
{
    use HasUuids;

    protected $table = 'engineering_intel_insights';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'company_id',
        'insight_type',
        'severity',
        'title',
        'description',
        'evidence',
        'is_acknowledged',
        'acknowledged_by',
        'acknowledged_at',
        'generated_at',
    ];

    protected function casts(): array
    {
        return [
            'evidence'        => 'array',
            'is_acknowledged' => 'boolean',
            'acknowledged_at' => 'datetime',
            'generated_at'    => 'datetime',
        ];
    }
}
