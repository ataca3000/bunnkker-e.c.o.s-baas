<?php

declare(strict_types=1);

namespace Modules\Crm\Customers\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One of a customer's emails. Exactly one is primary. */
class CustomerEmail extends Model
{
    use HasUuids;

    protected $table = 'crm_customer_emails';

    protected $fillable = ['customer_id', 'label', 'email', 'normalized', 'is_primary', 'is_verified'];

    protected function casts(): array
    {
        return ['is_primary' => 'boolean', 'is_verified' => 'boolean'];
    }

    protected static function booted(): void
    {
        static::saving(function (self $row): void {
            $row->normalized = self::normalize($row->email);
        });
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    public static function normalize(?string $email): ?string
    {
        if ($email === null) {
            return null;
        }
        $n = mb_strtolower(trim($email));

        return $n !== '' ? $n : null;
    }
}
