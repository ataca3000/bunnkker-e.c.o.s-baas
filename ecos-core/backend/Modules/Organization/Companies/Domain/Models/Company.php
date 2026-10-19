<?php

declare(strict_types=1);

namespace Modules\Organization\Companies\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Brands\Domain\Models\Brand;
use Modules\Organization\BusinessAccounts\Domain\Models\BusinessAccount;
use Modules\Organization\Companies\Infrastructure\Database\Factories\CompanyFactory;
use Modules\Organization\Teams\Domain\Models\Team;

/**
 * Company entity (UUID primary key, soft-deletable).
 *
 * @property string $id
 * @property string $code
 * @property string $name
 * @property bool $is_active
 */
class Company extends Model
{
    /** @use HasFactory<CompanyFactory> */
    use HasFactory, HasUuids, SoftDeletes;

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'code',
        'name',
        'legal_name',
        'tax_number',
        'commercial_registration',
        'email',
        'phone',
        'mobile',
        'website',
        'currency',
        'timezone',
        'language',
        'description',
        'country',
        'city',
        'address',
        'postal_code',
        'logo',
        'is_active',
        // Company Context fields
        'locale',
        'date_format',
        'number_format',
        'week_start',
        'fiscal_year_start',
        'fiscal_year_end',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'fiscal_year_start' => 'date',
            'fiscal_year_end' => 'date',
        ];
    }

    /** @return HasMany<Brand, $this> */
    public function brands(): HasMany
    {
        return $this->hasMany(Brand::class);
    }

    /** @return HasMany<Warehouse, $this> */
    public function warehouses(): HasMany
    {
        return $this->hasMany(Warehouse::class);
    }

    /** @return HasMany<Team, $this> */
    public function teams(): HasMany
    {
        return $this->hasMany(Team::class);
    }

    /** @return HasMany<BusinessAccount, $this> */
    public function businessAccounts(): HasMany
    {
        return $this->hasMany(BusinessAccount::class);
    }

    protected static function newFactory(): CompanyFactory
    {
        return CompanyFactory::new();
    }
}
