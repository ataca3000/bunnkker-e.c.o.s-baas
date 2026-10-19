<?php

declare(strict_types=1);

namespace Modules\Sales\Customers\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\Organization\Brands\Domain\Models\Brand;
use Modules\Organization\Companies\Domain\Models\Company;
use Modules\Sales\Customers\Infrastructure\Database\Factories\CustomerFactory;

/**
 * Customer aggregate — belongs to one Company; interacts with many Brands.
 *
 * company_id is mandatory and immutable after creation.
 * Brand associations are managed through the customer_brands relationship entity.
 * A Customer without a Company is an invalid aggregate.
 *
 * @property string      $id
 * @property string      $company_id
 * @property string      $code
 * @property string      $name
 * @property string|null $contact_person
 * @property string|null $email
 * @property string|null $phone
 * @property string|null $mobile
 * @property string|null $country
 * @property string|null $city
 * @property string|null $governorate
 * @property string|null $area
 * @property string|null $address
 * @property string|null $notes
 * @property bool        $is_active
 */
class Customer extends Model
{
    /** @use HasFactory<CustomerFactory> */
    use HasFactory, HasUuids, SoftDeletes;

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'company_id',
        'code',
        'name',
        'contact_person',
        'email',
        'phone',
        'mobile',
        'country',
        'city',
        'governorate',
        'area',
        'address',
        'notes',
        'is_active',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    /** @return BelongsTo<Company, $this> */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * The customer's brand relationship entities — primary access point for brand history.
     *
     * @return HasMany<CustomerBrand, $this>
     */
    public function customerBrands(): HasMany
    {
        return $this->hasMany(CustomerBrand::class);
    }

    /**
     * Convenience relationship for querying brands directly.
     * For brand history and statistics, use customerBrands().
     *
     * @return BelongsToMany<Brand, $this>
     */
    public function brands(): BelongsToMany
    {
        return $this->belongsToMany(Brand::class, 'customer_brands')
            ->withPivot(['id', 'is_primary', 'status', 'orders_count', 'lifetime_value', 'first_order_at', 'last_order_at'])
            ->withTimestamps();
    }

    /** @return HasMany<CustomerAddress, $this> */
    public function addresses(): HasMany
    {
        return $this->hasMany(CustomerAddress::class);
    }

    protected static function newFactory(): CustomerFactory
    {
        return CustomerFactory::new();
    }
}
