<?php

declare(strict_types=1);

namespace Modules\Marketing\Connections\Domain\Models;

use Exception;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Crypt;
use Modules\Marketing\Assets\Domain\Models\MarketingAsset;
use Modules\Marketing\Connections\Domain\Enums\ConnectionStatus;
use Modules\Marketing\Connections\Domain\Enums\ConnectorType;
use Modules\Marketing\Synchronization\Domain\Models\MarketingSyncLog;

/**
 * @property string $id
 * @property string|null $company_id
 * @property ConnectorType $connector_type
 * @property string $label
 * @property ConnectionStatus $status
 * @property string|null $external_account_id
 * @property string|null $access_token (encrypted at rest)
 * @property string|null $refresh_token (encrypted at rest)
 * @property \Carbon\Carbon|null $token_expires_at
 * @property array|null $scopes
 * @property array|null $required_scopes
 * @property \Carbon\Carbon|null $permissions_validated_at
 * @property \Carbon\Carbon|null $last_validated_at
 * @property string|null $connected_by
 * @property \Carbon\Carbon|null $disconnected_at
 * @property string|null $disconnected_by
 * @property array|null $connector_meta
 */
class MarketingConnection extends Model
{
    use HasUuids;

    protected $table = 'marketing_connections';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'connector_type',
        'label',
        'status',
        'external_account_id',
        'access_token',
        'refresh_token',
        'token_expires_at',
        'scopes',
        'required_scopes',
        'permissions_validated_at',
        'last_validated_at',
        'connected_by',
        'disconnected_at',
        'disconnected_by',
        'connector_meta',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'connector_type' => ConnectorType::class,
            'status' => ConnectionStatus::class,
            'token_expires_at' => 'datetime',
            'permissions_validated_at' => 'datetime',
            'last_validated_at' => 'datetime',
            'disconnected_at' => 'datetime',
            'scopes' => 'array',
            'required_scopes' => 'array',
            'connector_meta' => 'array',
        ];
    }

    // ── Token encryption ──────────────────────────────────────────────────────

    public function setAccessTokenAttribute(?string $value): void
    {
        $this->attributes['access_token'] = $value !== null ? Crypt::encryptString($value) : null;
    }

    public function getAccessTokenAttribute(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        try {
            return Crypt::decryptString($value);
        } catch (Exception) {
            return null;
        }
    }

    public function setRefreshTokenAttribute(?string $value): void
    {
        $this->attributes['refresh_token'] = $value !== null ? Crypt::encryptString($value) : null;
    }

    public function getRefreshTokenAttribute(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        try {
            return Crypt::decryptString($value);
        } catch (Exception) {
            return null;
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public function isActive(): bool
    {
        return $this->status === ConnectionStatus::Active;
    }

    public function isTokenExpired(): bool
    {
        return $this->token_expires_at !== null && $this->token_expires_at->isPast();
    }

    public function isTokenExpiringSoon(): bool
    {
        return $this->token_expires_at !== null
            && $this->token_expires_at->isBefore(now()->addHours(24));
    }

    // ── Relationships ─────────────────────────────────────────────────────────

    /** @return HasMany<MarketingAsset, $this> */
    public function assets(): HasMany
    {
        return $this->hasMany(MarketingAsset::class, 'marketing_connection_id');
    }

    /** @return HasMany<MarketingSyncLog, $this> */
    public function syncLogs(): HasMany
    {
        return $this->hasMany(MarketingSyncLog::class, 'marketing_connection_id');
    }
}
