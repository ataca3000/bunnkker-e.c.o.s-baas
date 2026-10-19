<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\ValueObjects;

/**
 * Immutable, fully-resolved job profile (ADR-039).
 *
 * Produced from a single template `definition` (via fromArray) or from composing several
 * templates (via RoleCompositionService). This is what preview, comparison, and the
 * template→role compiler all consume — a normalised, side-effect-free snapshot.
 */
final class EffectiveRoleProfile
{
    /**
     * @param  list<string>  $permissions       granted permission names / wildcards
     * @param  list<string>  $deniedPermissions explicit denies (override grants)
     * @param  list<string>  $hiddenFields      sensitive field tokens hidden from this role
     * @param  array<string,string>  $scopes    resource => DataScope value
     * @param  list<string>  $policies          policy-bundle keys
     * @param  list<string>  $navigation        navigable module ids
     * @param  array<string,mixed>  $dashboard  { profile, widgetOrder, hidden, collapsed }
     * @param  array<string,mixed>  $preferences { theme, language, dashboardProfile }
     * @param  list<string>  $quickActions
     * @param  list<string>  $sources           contributing template keys
     */
    private function __construct(
        public readonly array $permissions,
        public readonly array $deniedPermissions,
        public readonly array $hiddenFields,
        public readonly array $scopes,
        public readonly array $policies,
        public readonly array $navigation,
        public readonly array $dashboard,
        public readonly ?string $landingPage,
        public readonly array $preferences,
        public readonly array $quickActions,
        public readonly array $sources,
    ) {}

    /**
     * @param  array<string,mixed>  $definition
     * @param  list<string>  $sources
     */
    public static function fromArray(array $definition, array $sources = []): self
    {
        $visibility = (array) ($definition['visibility'] ?? []);

        return new self(
            permissions: self::stringList($definition['permissions'] ?? []),
            deniedPermissions: self::stringList($definition['deny'] ?? $definition['denied_permissions'] ?? []),
            hiddenFields: self::stringList($visibility['hidden_fields'] ?? $visibility['hide'] ?? []),
            scopes: self::stringMap($definition['scopes'] ?? []),
            policies: self::stringList($definition['policies'] ?? []),
            navigation: self::stringList(($definition['navigation']['modules'] ?? $definition['navigation'] ?? [])),
            dashboard: (array) ($definition['dashboard'] ?? []),
            landingPage: isset($definition['landing_page']) ? (string) $definition['landing_page'] : null,
            preferences: (array) ($definition['preferences'] ?? []),
            quickActions: self::stringList($definition['quick_actions'] ?? []),
            sources: array_values(array_unique($sources)),
        );
    }

    public static function empty(): self
    {
        return new self([], [], [], [], [], [], [], null, [], [], []);
    }

    /**
     * Rebuild from already-resolved parts (used by the composition service).
     *
     * @param  array<string,mixed>  $parts
     */
    public static function of(array $parts): self
    {
        return new self(
            permissions: self::stringList($parts['permissions'] ?? []),
            deniedPermissions: self::stringList($parts['deniedPermissions'] ?? []),
            hiddenFields: self::stringList($parts['hiddenFields'] ?? []),
            scopes: self::stringMap($parts['scopes'] ?? []),
            policies: self::stringList($parts['policies'] ?? []),
            navigation: self::stringList($parts['navigation'] ?? []),
            dashboard: (array) ($parts['dashboard'] ?? []),
            landingPage: isset($parts['landingPage']) ? (string) $parts['landingPage'] : null,
            preferences: (array) ($parts['preferences'] ?? []),
            quickActions: self::stringList($parts['quickActions'] ?? []),
            sources: self::stringList($parts['sources'] ?? []),
        );
    }

    public function grantsPermission(string $name): bool
    {
        return in_array($name, $this->permissions, true) && ! in_array($name, $this->deniedPermissions, true);
    }

    public function scopeFor(string $resource): string
    {
        return $this->scopes[$resource] ?? 'all';
    }

    public function hidesField(string $field): bool
    {
        return in_array($field, $this->hiddenFields, true);
    }

    /** @return array<string,mixed> */
    public function toArray(): array
    {
        return [
            'permissions' => $this->permissions,
            'deny' => $this->deniedPermissions,
            'visibility' => ['hidden_fields' => $this->hiddenFields],
            'scopes' => $this->scopes,
            'policies' => $this->policies,
            'navigation' => ['modules' => $this->navigation],
            'dashboard' => $this->dashboard,
            'landing_page' => $this->landingPage,
            'preferences' => $this->preferences,
            'quick_actions' => $this->quickActions,
            'sources' => $this->sources,
        ];
    }

    /** @return list<string> */
    private static function stringList(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        return array_values(array_unique(array_map(static fn ($v): string => (string) $v, $value)));
    }

    /** @return array<string,string> */
    private static function stringMap(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        $out = [];
        foreach ($value as $k => $v) {
            $out[(string) $k] = (string) $v;
        }

        return $out;
    }
}
