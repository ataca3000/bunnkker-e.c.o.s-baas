<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderConfig\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * Runtime-configurable credentials for a marketing platform provider.
 *
 * Credentials are stored encrypted at rest using Laravel's built-in
 * encryption (keyed to APP_KEY). The app_secret and extra_config
 * columns are never returned in API responses.
 *
 * @property string $id
 * @property string $company_id
 * @property string $provider meta | google_ads | tiktok | snapchat | linkedin | x_twitter
 * @property string|null $app_id
 * @property string|null $app_secret encrypted
 * @property string|null $redirect_uri
 * @property array|null $extra_config encrypted JSON
 * @property string $status not_configured | invalid | ready
 * @property \Carbon\Carbon|null $validated_at
 * @property string|null $validated_by
 * @property string|null $created_by
 * @property string|null $updated_by
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
final class MarketingProviderCredential extends Model
{
    protected $table = 'marketing_provider_credentials';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'company_id',
        'provider',
        'app_id',
        'app_secret',
        'redirect_uri',
        'extra_config',
        'status',
        'validated_at',
        'validated_by',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'app_secret' => 'encrypted',
        'extra_config' => 'encrypted:array',
        'validated_at' => 'datetime',
    ];

    protected static function boot(): void
    {
        parent::boot();
        self::creating(static function (self $model): void {
            if (empty($model->id)) {
                $model->id = Str::uuid()->toString();
            }
        });
    }
}
