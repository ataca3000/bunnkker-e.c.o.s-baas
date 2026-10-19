<?php

declare(strict_types=1);

namespace Modules\Crm\Customers\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/** An append-only record of a customer merge. */
class CustomerMerge extends Model
{
    use HasUuids;

    protected $table = 'crm_customer_merges';

    protected $fillable = [
        'company_id', 'surviving_customer_id', 'merged_customer_id',
        'summary', 'performed_by', 'performed_at',
    ];

    protected function casts(): array
    {
        return ['summary' => 'array', 'performed_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::updating(static fn (): bool => false);
        static::deleting(static fn (): bool => false);
    }
}
