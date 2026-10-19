<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Application\Services;

use InvalidArgumentException;
use Modules\CustomerEngagement\Application\ChannelProviders\InstagramProvider;
use Modules\CustomerEngagement\Application\ChannelProviders\MessengerProvider;
use Modules\CustomerEngagement\Application\ChannelProviders\WhatsAppProvider;
use Modules\CustomerEngagement\Application\Contracts\ChannelProviderContract;
use Modules\CustomerEngagement\Domain\Enums\ChannelProviderStatus;
use Modules\CustomerEngagement\Domain\Models\ChannelProvider;

class ChannelProviderService
{
    public function findByChannel(string $channel, ?string $companyId = null): ?ChannelProvider
    {
        return ChannelProvider::query()
            ->where('channel', $channel)
            ->where('status', ChannelProviderStatus::ACTIVE->value)
            ->when($companyId, fn ($q) => $q->where('company_id', $companyId))
            ->first();
    }

    public function makeProvider(ChannelProvider $config): ChannelProviderContract
    {
        return match ($config->channel) {
            'whatsapp' => new WhatsAppProvider($config),
            'messenger' => new MessengerProvider($config),
            'instagram_direct' => new InstagramProvider($config),
            default => throw new InvalidArgumentException("Unknown channel: {$config->channel}"),
        };
    }

    public function create(array $data): ChannelProvider
    {
        return ChannelProvider::create(array_merge($data, [
            'status' => ChannelProviderStatus::INACTIVE->value,
        ]));
    }

    public function activate(ChannelProvider $provider): ChannelProvider
    {
        $provider->update(['status' => ChannelProviderStatus::ACTIVE->value, 'last_error' => null]);

        return $provider->fresh();
    }

    public function markError(ChannelProvider $provider, string $error): void
    {
        $provider->update(['status' => ChannelProviderStatus::ERROR->value, 'last_error' => $error]);
    }

    public function paginate(array $filters, int $perPage = 20): \Illuminate\Contracts\Pagination\LengthAwarePaginator
    {
        return ChannelProvider::query()
            ->when(! empty($filters['company_id']), fn ($q) => $q->where('company_id', $filters['company_id']))
            ->when(! empty($filters['channel']), fn ($q) => $q->where('channel', $filters['channel']))
            ->latest()
            ->paginate($perPage);
    }
}
