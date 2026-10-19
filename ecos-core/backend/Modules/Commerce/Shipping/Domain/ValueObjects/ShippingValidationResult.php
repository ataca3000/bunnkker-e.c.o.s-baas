<?php

declare(strict_types=1);

namespace Modules\Commerce\Shipping\Domain\ValueObjects;

/**
 * Immutable result of the Shipping Engine.
 *
 * Replaces all RuntimeException-based shipping rejections.
 * Carry this VO across the order-creation pipeline — never throw.
 */
final class ShippingValidationResult
{
    /** @param 'allow'|'pending_review'|'reject'|'walk_in' $decision */
    private function __construct(
        public readonly bool $allowed,
        public readonly string $decision,
        public readonly string $reason,
        public readonly float $shippingPrice,
        public readonly ?int $deliveryDays,
        public readonly bool $sameDay,
        public readonly bool $codAllowed,
        public readonly ?string $preferredProvider,
        public readonly ?int $resolvedGovernorateId,
        public readonly ?int $resolvedCityId,
    ) {}

    // ── Named constructors ────────────────────────────────────────────────────

    public static function allow(
        float $shippingPrice,
        ?int $deliveryDays,
        bool $sameDay,
        bool $codAllowed,
        ?string $preferredProvider,
        ?int $resolvedGovernorateId,
        ?int $resolvedCityId,
    ): self {
        return new self(
            allowed: true,
            decision: 'allow',
            reason: '',
            shippingPrice: $shippingPrice,
            deliveryDays: $deliveryDays,
            sameDay: $sameDay,
            codAllowed: $codAllowed,
            preferredProvider: $preferredProvider,
            resolvedGovernorateId: $resolvedGovernorateId,
            resolvedCityId: $resolvedCityId,
        );
    }

    public static function pendingReview(
        string $reason,
        float $shippingPrice,
        ?int $deliveryDays,
        bool $sameDay,
        bool $codAllowed,
        ?string $preferredProvider,
        ?int $resolvedGovernorateId,
        ?int $resolvedCityId,
    ): self {
        return new self(
            allowed: false,
            decision: 'pending_review',
            reason: $reason,
            shippingPrice: $shippingPrice,
            deliveryDays: $deliveryDays,
            sameDay: $sameDay,
            codAllowed: $codAllowed,
            preferredProvider: $preferredProvider,
            resolvedGovernorateId: $resolvedGovernorateId,
            resolvedCityId: $resolvedCityId,
        );
    }

    public static function reject(
        string $reason,
        ?int $resolvedGovernorateId = null,
        ?int $resolvedCityId = null,
    ): self {
        return new self(
            allowed: false,
            decision: 'reject',
            reason: $reason,
            shippingPrice: 0.0,
            deliveryDays: null,
            sameDay: false,
            codAllowed: false,
            preferredProvider: null,
            resolvedGovernorateId: $resolvedGovernorateId,
            resolvedCityId: $resolvedCityId,
        );
    }

    /**
     * Walk-in POS — no delivery, no validation needed.
     */
    public static function walkIn(): self
    {
        return new self(
            allowed: true,
            decision: 'walk_in',
            reason: '',
            shippingPrice: 0.0,
            deliveryDays: null,
            sameDay: false,
            codAllowed: false,
            preferredProvider: null,
            resolvedGovernorateId: null,
            resolvedCityId: null,
        );
    }

    // ── Query methods ─────────────────────────────────────────────────────────

    public function isAllowed(): bool
    {
        return $this->allowed;
    }

    public function requiresReview(): bool
    {
        return $this->decision === 'pending_review';
    }

    public function isRejected(): bool
    {
        return $this->decision === 'reject';
    }

    public function isWalkIn(): bool
    {
        return $this->decision === 'walk_in';
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        $coverageStatus = match ($this->decision) {
            'allow' => 'covered',
            'pending_review' => 'needs_review',
            'reject' => 'unavailable',
            default => 'walk_in',
        };

        return [
            'available' => $this->allowed,
            'decision' => $this->decision,
            'coverage_status' => $coverageStatus,
            'validation_message' => $this->reason !== '' ? $this->reason : null,
            'shipping_price' => $this->shippingPrice > 0 ? $this->shippingPrice : null,
            'delivery_days' => $this->deliveryDays,
            'same_day' => $this->sameDay,
            'cod_allowed' => $this->codAllowed,
            'preferred_provider' => $this->preferredProvider,
            'governorate_id' => $this->resolvedGovernorateId,
            'city_id' => $this->resolvedCityId,
        ];
    }
}
