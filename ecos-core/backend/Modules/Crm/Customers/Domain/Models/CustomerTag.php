<?php

declare(strict_types=1);

namespace Modules\Crm\Customers\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/** A free-form segmentation label a customer can carry. */
class CustomerTag extends Model
{
    use HasUuids;

    protected $table = 'crm_customer_tags';

    protected $fillable = ['company_id', 'name', 'color'];

    public function customers(): BelongsToMany
    {
        return $this->belongsToMany(Customer::class, 'crm_customer_tag_assignments', 'tag_id', 'customer_id')->withTimestamps();
    }
}
