<?php

declare(strict_types=1);

namespace Modules\Crm\Customers\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One of a customer's phone numbers. Exactly one is primary. */
class CustomerPhone extends Model
{
    use HasUuids;

    protected $table = 'crm_customer_phones';

    protected $fillable = ['customer_id', 'label', 'phone', 'normalized', 'is_primary', 'is_verified'];

    protected function casts(): array
    {
        return ['is_primary' => 'boolean', 'is_verified' => 'boolean'];
    }

    protected static function booted(): void
    {
        static::saving(function (self $row): void {
            $row->normalized = self::normalize($row->phone);
        });
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    /** Digits only, for duplicate matching. */
    public static function normalize(?string $phone): ?string
    {
        if ($phone === null) {
            return null;
        }
        $digits = preg_replace('/\D+/', '', $phone);

        return $digits !== '' ? $digits : null;
    }
}
