<?php

declare(strict_types=1);

namespace Modules\Crm\Customers\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A customer classification (retail / wholesale / VIP …). */
class CustomerGroup extends Model
{
    use HasUuids;

    protected $table = 'crm_customer_groups';

    protected $fillable = ['company_id', 'name', 'description', 'is_default'];

    protected function casts(): array
    {
        return ['is_default' => 'boolean'];
    }

    public function customers(): HasMany
    {
        return $this->hasMany(Customer::class, 'customer_group_id');
    }
}
