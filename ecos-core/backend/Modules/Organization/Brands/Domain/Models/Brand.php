<?php

declare(strict_types=1);

namespace Modules\Organization\Brands\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Organization\Brands\Infrastructure\Database\Factories\BrandFactory;
use Modules\Organization\BusinessAccounts\Domain\Models\BusinessAccount;
use Modules\Organization\Companies\Domain\Models\Company;

/**
 * Brand aggregate root. Brands replace the deprecated Branch concept.
 * Every Brand belongs to a Company and carries its own identity and channels.
 *
 * @property string $id
 * @property string $company_id
 * @property string $code
 * @property string $name
 * @property string $slug
 * @property string|null $logo
 * @property string|null $description
 * @property bool $is_active
 */
class Brand extends Model
{
    /** @use HasFactory<BrandFactory> */
    use HasFactory, HasUuids, SoftDeletes;

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'code',
        'name',
        'slug',
        'logo',
        'description',
        'is_active',
        'default_target_margin',
        'default_markup',
        'default_discount_pct',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'default_target_margin' => 'float',
            'default_markup' => 'float',
            'default_discount_pct' => 'float',
        ];
    }

    /** @return BelongsTo<Company, $this> */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /** @return HasMany<BusinessAccount, $this> */
    public function businessAccounts(): HasMany
    {
        return $this->hasMany(BusinessAccount::class);
    }

    /** @return HasMany<Channel, $this> */
    public function channels(): HasMany
    {
        return $this->hasMany(Channel::class);
    }

    /** @return HasMany<Product, $this> */
    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    /** @return \Illuminate\Database\Eloquent\Relations\HasOne<BrandShippingSettings, $this> */
    public function shippingSettings(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(BrandShippingSettings::class);
    }

    protected static function newFactory(): BrandFactory
    {
        return BrandFactory::new();
    }
}
