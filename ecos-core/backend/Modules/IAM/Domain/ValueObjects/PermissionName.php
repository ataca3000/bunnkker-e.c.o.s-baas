<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\ValueObjects;

use Modules\IAM\Domain\Exceptions\InvalidPermissionNameException;
use Stringable;

/**
 * PermissionName — value object for the ECOS permission grammar.
 *
 * Canonical form:  {module}.{resource}.{action}   e.g. inventory.products.view_cost
 * Also accepts the module-wide two-segment form ECOS already uses:
 *                  {module}.{action}              e.g. operations.view
 *
 * Responsibilities (TASK-IAM-002 Phase 1, Part 4):
 *   • Validation     — reject malformed names (wrong segment count, bad chars).
 *   • Normalization  — lowercase every segment and split CamelCase into snake_case
 *                      so the task's illustrative "Inventory.Products.ViewCost"
 *                      resolves to the real stored name "inventory.products.view_cost".
 *   • Formatting     — a single canonical string, so no scattered string literals.
 *
 * Immutable: all properties are readonly and set once via the private constructor.
 *
 * NOTE: this VO is a definition-time helper (registry, module registration, and any
 * caller that wants a typed name). The runtime authorization path intentionally does
 * NOT re-normalise raw strings it receives (see AuthorizationGateway) — that keeps the
 * gateway byte-for-byte identical to the existing PermissionService and tolerant of
 * names outside this grammar (e.g. legacy four-segment names). Phase 1 changes no behaviour.
 */
final class PermissionName implements Stringable
{
    private function __construct(
        public readonly string $value,
        public readonly string $module,
        public readonly ?string $resource,
        public readonly string $action,
    ) {
    }

    /**
     * Parse and normalise a raw permission string.
     *
     * @throws InvalidPermissionNameException
     */
    public static function from(string $raw): self
    {
        $normalized = self::normalize($raw);

        if ($normalized === '') {
            throw InvalidPermissionNameException::forValue($raw, 'name is empty');
        }

        $parts = explode('.', $normalized);
        $count = count($parts);

        if ($count < 2 || $count > 3) {
            throw InvalidPermissionNameException::forValue(
                $raw,
                'expected 2 (module.action) or 3 (module.resource.action) segments, got '.$count,
            );
        }

        foreach ($parts as $segment) {
            if (! preg_match('/^[a-z][a-z0-9_]*$/', $segment)) {
                throw InvalidPermissionNameException::forValue(
                    $raw,
                    sprintf('segment "%s" must match [a-z][a-z0-9_]*', $segment),
                );
            }
        }

        return $count === 3
            ? new self($normalized, $parts[0], $parts[1], $parts[2])
            : new self($normalized, $parts[0], null, $parts[1]);
    }

    /**
     * Parse without throwing. Returns null on an invalid name.
     */
    public static function tryFrom(string $raw): ?self
    {
        try {
            return self::from($raw);
        } catch (InvalidPermissionNameException) {
            return null;
        }
    }

    public static function isValid(string $raw): bool
    {
        return self::tryFrom($raw) !== null;
    }

    public function value(): string
    {
        return $this->value;
    }

    public function module(): string
    {
        return $this->module;
    }

    public function resource(): ?string
    {
        return $this->resource;
    }

    public function action(): string
    {
        return $this->action;
    }

    public function equals(self $other): bool
    {
        return $this->value === $other->value;
    }

    public function __toString(): string
    {
        return $this->value;
    }

    /**
     * Lowercase each dot-segment and convert CamelCase to snake_case, dropping
     * empty segments and surrounding whitespace.
     */
    private static function normalize(string $raw): string
    {
        $segments = array_filter(
            array_map('trim', explode('.', trim($raw))),
            static fn (string $s): bool => $s !== '',
        );

        $normalized = array_map(static function (string $segment): string {
            // insert underscore between a lower/digit and an upper: "viewCost" -> "view_Cost"
            $segment = (string) preg_replace('/([a-z0-9])([A-Z])/', '$1_$2', $segment);
            // handle acronym boundaries: "HTTPServer" -> "HTTP_Server"
            $segment = (string) preg_replace('/([A-Z]+)([A-Z][a-z])/', '$1_$2', $segment);

            return strtolower($segment);
        }, $segments);

        return implode('.', $normalized);
    }
}
