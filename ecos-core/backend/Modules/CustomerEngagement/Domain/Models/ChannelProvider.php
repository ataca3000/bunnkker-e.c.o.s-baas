<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\CustomerEngagement\Domain\Enums\ChannelProviderStatus;

class ChannelProvider extends Model
{
    use HasUuids, SoftDeletes;

    protected $table = 'cep_channel_providers';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'status' => ChannelProviderStatus::class,
            'credentials' => 'array',
            'last_verified_at' => 'datetime',
        ];
    }

    public function isActive(): bool
    {
        return $this->status === ChannelProviderStatus::ACTIVE;
    }

    public function getCredential(string $key): mixed
    {
        return $this->credentials[$key] ?? null;
    }
}
