<?php

declare(strict_types=1);

namespace Modules\Finance\Posting\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * A posting rule — configuration mapping an event type to a set of journal legs.
 * The Strategy the Posting Engine resolves in F3. It never writes the ledger;
 * it only describes the shape of a journal.
 */
class PostingRule extends Model
{
    protected $table = 'finance_posting_rules';

    /** @var array<string, mixed> */
    protected $attributes = ['is_active' => true];

    protected $fillable = [
        'uuid', 'company_id', 'code', 'event_type', 'description', 'legs', 'is_active',
    ];

    protected function casts(): array
    {
        return ['legs' => 'array', 'is_active' => 'boolean'];
    }

    protected static function booted(): void
    {
        static::creating(function (self $rule): void {
            if ($rule->uuid === null) {
                $rule->uuid = (string) Str::uuid();
            }
        });
    }
}
