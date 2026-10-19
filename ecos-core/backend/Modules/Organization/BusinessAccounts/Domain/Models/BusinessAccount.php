<?php

declare(strict_types=1);

namespace Modules\Organization\BusinessAccounts\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Organization\Brands\Domain\Models\Brand;
use Modules\Organization\BusinessAccounts\Infrastructure\Database\Factories\BusinessAccountFactory;
use Modules\Organization\Companies\Domain\Models\Company;

/**
 * BusinessAccount aggregate root.
 * Represents an external platform account (Meta, WooCommerce, etc.) linked to a company/brand.
 *
 * @property string $id
 * @property string $company_id
 * @property string|null $brand_id
 * @property string $code
 * @property string $name
 * @property string $provider
 * @property string $status
 * @property string|null $description
 * @property string|null $logo
 * @property array|null $oauth_config
 * @property array|null $api_keys
 * @property array|null $webhook_config
 * @property array|null $sync_settings
 * @property array|null $external_metadata
 */
class BusinessAccount extends Model
{
    /** @use HasFactory<BusinessAccountFactory> */
    use HasFactory, HasUuids, SoftDeletes;

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'brand_id',
        'code',
        'name',
        'provider',
        'status',
        'description',
        'logo',
        'oauth_config',
        'api_keys',
        'webhook_config',
        'sync_settings',
        'external_metadata',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'oauth_config' => 'array',
            'api_keys' => 'array',
            'webhook_config' => 'array',
            'sync_settings' => 'array',
            'external_metadata' => 'array',
        ];
    }

    /** @return BelongsTo<Company, $this> */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /** @return BelongsTo<Brand, $this> */
    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    /** @return HasMany<Channel, $this> */
    public function channels(): HasMany
    {
        return $this->hasMany(Channel::class);
    }

    protected static function newFactory(): BusinessAccountFactory
    {
        return BusinessAccountFactory::new();
    }
}
