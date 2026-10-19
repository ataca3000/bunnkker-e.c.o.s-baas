<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\ValueObjects;

use DateTimeImmutable;

/**
 * AuthorizationDecision — the immutable, explainable result of a platform decision
 * (TASK-IAM-002 / ADR-038, Part 1).
 *
 * Carries every dimension of the five-engine platform:
 *   allowed / permission / matchedPermission / matchedRole  (Authorization)
 *   hiddenFields                                             (Visibility)
 *   matchedScope                                             (Data Scope)
 *   matchedPolicy                                            (Policy)
 *   reason / decidedAt / source                              (Audit)
 *
 * Immutable: readonly properties, private constructor, named factories, and copy-on-write
 * "with*" methods used by the Gateway to compose the engines' contributions.
 */
final class AuthorizationDecision
{
    /**
     * @param  list<string>|null  $hiddenFields
     */
    private function __construct(
        public readonly bool $allowed,
        public readonly string $permission,
        public readonly ?string $matchedPermission,
        public readonly ?string $matchedRole,
        public readonly ?string $matchedScope,
        public readonly ?string $matchedPolicy,
        public readonly ?array $hiddenFields,
        public readonly string $reason,
        public readonly DateTimeImmutable $decidedAt,
        public readonly string $source,
    ) {
    }

    public static function allow(
        string $permission,
        ?string $matchedPermission = null,
        ?string $matchedRole = null,
        string $reason = 'permission granted',
        string $source = 'authorization',
    ): self {
        return new self(
            allowed: true,
            permission: $permission,
            matchedPermission: $matchedPermission,
            matchedRole: $matchedRole,
            matchedScope: null,
            matchedPolicy: null,
            hiddenFields: null,
            reason: $reason,
            decidedAt: new DateTimeImmutable(),
            source: $source,
        );
    }

    public static function deny(
        string $permission,
        string $reason = 'permission denied',
        string $source = 'authorization',
    ): self {
        return new self(
            allowed: false,
            permission: $permission,
            matchedPermission: null,
            matchedRole: null,
            matchedScope: null,
            matchedPolicy: null,
            hiddenFields: null,
            reason: $reason,
            decidedAt: new DateTimeImmutable(),
            source: $source,
        );
    }

    /**
     * @param  list<string>  $fields
     */
    public function withHiddenFields(array $fields): self
    {
        return $this->copy(hiddenFields: $fields);
    }

    public function withScope(?string $scope): self
    {
        return $this->copy(matchedScope: $scope);
    }

    public function withPolicy(?string $policy): self
    {
        return $this->copy(matchedPolicy: $policy);
    }

    /**
     * Return a denied copy (deny-overrides during composition), preserving the audit trail.
     */
    public function deniedBecause(string $reason, string $source): self
    {
        return $this->copy(allowed: false, reason: $reason, source: $source);
    }

    public function isAllowed(): bool
    {
        return $this->allowed;
    }

    public function isDenied(): bool
    {
        return ! $this->allowed;
    }

    public function reason(): string
    {
        return $this->reason;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'allowed' => $this->allowed,
            'permission' => $this->permission,
            'matched_permission' => $this->matchedPermission,
            'matched_role' => $this->matchedRole,
            'matched_scope' => $this->matchedScope,
            'matched_policy' => $this->matchedPolicy,
            'hidden_fields' => $this->hiddenFields,
            'reason' => $this->reason,
            'decided_at' => $this->decidedAt->format(DATE_ATOM),
            'source' => $this->source,
        ];
    }

    /**
     * @param  list<string>|null  $hiddenFields
     */
    private function copy(
        ?bool $allowed = null,
        ?string $matchedScope = null,
        ?string $matchedPolicy = null,
        ?array $hiddenFields = null,
        ?string $reason = null,
        ?string $source = null,
    ): self {
        return new self(
            allowed: $allowed ?? $this->allowed,
            permission: $this->permission,
            matchedPermission: $this->matchedPermission,
            matchedRole: $this->matchedRole,
            matchedScope: $matchedScope ?? $this->matchedScope,
            matchedPolicy: $matchedPolicy ?? $this->matchedPolicy,
            hiddenFields: $hiddenFields ?? $this->hiddenFields,
            reason: $reason ?? $this->reason,
            decidedAt: $this->decidedAt,
            source: $source ?? $this->source,
        );
    }
}
