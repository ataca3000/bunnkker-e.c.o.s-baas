<?php

declare(strict_types=1);

namespace Modules\Crm\Intelligence\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/** A named RFM segment definition (system template or company override). */
class CustomerSegment extends Model
{
    use HasUuids;

    protected $table = 'crm_customer_segments';

    protected $fillable = [
        'company_id', 'key', 'name', 'description',
        'color', 'priority', 'is_retention_focus', 'is_system',
    ];

    protected function casts(): array
    {
        return [
            'priority' => 'integer',
            'is_retention_focus' => 'boolean',
            'is_system' => 'boolean',
        ];
    }
}
