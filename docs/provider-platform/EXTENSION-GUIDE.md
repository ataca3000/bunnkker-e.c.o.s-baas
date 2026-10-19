# Provider Platform — Extension Guide

---

## How to Add a New Provider

### Step 1 — Register the `ProviderDefinition`

Open `ProviderPlatformServiceProvider::register()` and add a new entry inside the `ProviderRegistry` singleton factory:

```php
$registry->register(new ProviderDefinition(
    providerKey:      'pinterest',
    displayName:      'Pinterest Ads',
    providerType:     'social_platform',
    version:          'v5',
    capabilities:     [
        ProviderCapability::OAUTH,
        ProviderCapability::CAMPAIGNS,
        ProviderCapability::ADS,
        ProviderCapability::CATALOGS,
    ],
    documentationUrl: 'https://developers.pinterest.com/docs/api/v5/',
));
```

The provider immediately becomes discoverable via `ProviderRegistry::resolve('pinterest')` and in the `/api/marketing/providers` endpoint.

### Step 2 — Add the provider type to `ProviderEventPublisher::PROVIDER_TYPES`

```php
private const PROVIDER_TYPES = [
    // ... existing entries ...
    'pinterest' => 'social_platform',
];
```

### Step 3 — Create a credential validator

```php
// Modules/Marketing/ProviderConfig/Application/Services/PinterestConfigValidator.php
final class PinterestConfigValidator implements ProviderValidatorInterface
{
    public function validate(string $appId, string $appSecret): array
    {
        // call Pinterest API to verify credentials
        // return ['valid' => bool, 'errors' => list<string>]
    }
}
```

Register it in `ProviderConfigServiceProvider`:

```php
$registry->register('pinterest', $app->make(PinterestConfigValidator::class));
```

### Step 4 — Create the connector (optional)

Implement `ProviderConnectorInterface` for full OAuth + sync lifecycle support:

```php
// Modules/Marketing/PinterestConnector/...
final class PinterestConnector implements ProviderConnectorInterface
{
    public function getProviderKey(): string { return 'pinterest'; }
    // ... implement all 12 methods
}
```

Bind it in the connector's service provider — nothing else in the platform needs to know the concrete class.

---

## How to Subscribe to Provider Events

### Option A — Event listener (recommended)

Register a listener in your module's service provider:

```php
// In your module's ServiceProvider::boot()
Event::listen(
    \Modules\Marketing\ProviderPlatform\Domain\Events\ProviderConnected::class,
    YourListener::class,
);
```

Implement `ShouldQueue` for async handling:

```php
final class SyncAccountsOnProviderConnected implements ShouldQueue
{
    use InteractsWithQueue;

    public string $queue = 'default';

    public function handle(ProviderConnected $event): void
    {
        // $event->companyId, $event->provider are always available
        // NEVER read secrets from here — they are not in the event
    }
}
```

### Option B — Subscribe to AbstractProviderEvent

To receive all events through a single listener:

```php
Event::listen(
    \Modules\Marketing\ProviderPlatform\Domain\Events\AbstractProviderEvent::class,
    YourCatchAllListener::class,
);
```

### Option C — Query the events table directly (for replay / analytics)

```php
DB::table('marketing_provider_events')
    ->where('company_id', $companyId)
    ->where('provider', 'meta')
    ->where('event_name', 'provider.connected')
    ->orderBy('occurred_at', 'desc')
    ->get();
```

---

## How to Check Provider Capabilities (No Hardcoded Provider Names)

**Wrong:**
```php
if ($provider === 'meta' || $provider === 'tiktok') {
    // show catalog sync option
}
```

**Right:**
```php
if ($this->engine->supports($providerKey, ProviderCapability::CATALOGS)) {
    // show catalog sync option
}
```

Or, to find all providers that support a capability:

```php
$providerKeys = $this->engine->providersWithCapability(ProviderCapability::COMMERCE);
```

---

## How to Emit a Provider Event

Always use `ProviderEventPublisher` — never construct event objects directly:

```php
// Good
$this->publisher->providerSyncCompleted(
    companyId:        $companyId,
    provider:         'meta',
    connectionId:     $connectionId,
    assetsDiscovered: 142,
    durationSeconds:  8,
);

// Bad — do not do this
Event::dispatch(new ProviderSyncCompleted(...));
```

The publisher handles deduplication, persistence, and dispatch. Your call site never throws.

---

## Capability Constants Reference

```php
use Modules\Marketing\ProviderPlatform\Domain\Enums\ProviderCapability;

ProviderCapability::OAUTH        // 'oauth'
ProviderCapability::WEBHOOKS     // 'webhooks'
ProviderCapability::CAMPAIGNS    // 'campaigns'
ProviderCapability::ADS          // 'ads'
ProviderCapability::ANALYTICS    // 'analytics'
ProviderCapability::CATALOGS     // 'catalogs'
ProviderCapability::COMMERCE     // 'commerce'
ProviderCapability::MESSAGING    // 'messaging'
ProviderCapability::LEAD_FORMS   // 'lead_forms'
ProviderCapability::INSTAGRAM    // 'instagram'
ProviderCapability::YOUTUBE      // 'youtube'
ProviderCapability::WHATSAPP     // 'whatsapp'
```

---

## Architecture Rules

1. **No provider-specific imports in shared code.** `ProviderCredentialService`, `ProviderHealthMonitor`, and all platform services must never import `MetaConnector`, `GoogleAdsConnector`, etc. Only the connector's own service provider knows its concrete class.

2. **Events carry no secrets.** Proof: all `ProviderEventPublisher` factory methods accept only safe values (app_id, status, error messages). Any future factory method must follow the same rule.

3. **Capability checks replace provider checks.** Before writing `if ($provider === 'x')`, check whether there is a `ProviderCapability` constant that expresses the same constraint. If not, add one.

4. **The registry is the source of truth for provider metadata.** Don't store provider display names, types, or versions in routes, config files, or constants scattered across the codebase.
