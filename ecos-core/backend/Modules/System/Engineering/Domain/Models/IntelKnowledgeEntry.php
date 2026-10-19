<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class IntelKnowledgeEntry extends Model
{
    use HasUuids;

    protected $table = 'engineering_intel_knowledge';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'company_id',
        'category',
        'failure_type',
        'root_cause',
        'resolution_approach',
        'occurrences',
        'success_count',
        'failure_count',
        'confidence',
        'last_seen_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'occurrences'   => 'integer',
            'success_count' => 'integer',
            'failure_count' => 'integer',
            'confidence'    => 'float',
            'last_seen_at'  => 'datetime',
            'metadata'      => 'array',
        ];
    }
}
