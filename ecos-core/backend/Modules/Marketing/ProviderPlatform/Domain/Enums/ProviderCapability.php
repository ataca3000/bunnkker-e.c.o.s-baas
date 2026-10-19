<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Domain\Enums;

/**
 * Canonical capability identifiers for marketing providers.
 *
 * No hardcoded provider checks anywhere in the application.
 * Use ProviderCapabilityEngine::supports() to check at runtime.
 */
final class ProviderCapability
{
    public const OAUTH = 'oauth';

    public const WEBHOOKS = 'webhooks';

    public const CAMPAIGNS = 'campaigns';

    public const ADS = 'ads';

    public const ANALYTICS = 'analytics';

    public const CATALOGS = 'catalogs';

    public const COMMERCE = 'commerce';

    public const MESSAGING = 'messaging';

    public const LEAD_FORMS = 'lead_forms';

    public const INSTAGRAM = 'instagram';

    public const YOUTUBE = 'youtube';

    public const WHATSAPP = 'whatsapp';

    /** @return list<string> all defined capability constants */
    public static function all(): array
    {
        return [
            self::OAUTH,
            self::WEBHOOKS,
            self::CAMPAIGNS,
            self::ADS,
            self::ANALYTICS,
            self::CATALOGS,
            self::COMMERCE,
            self::MESSAGING,
            self::LEAD_FORMS,
            self::INSTAGRAM,
            self::YOUTUBE,
            self::WHATSAPP,
        ];
    }
}
