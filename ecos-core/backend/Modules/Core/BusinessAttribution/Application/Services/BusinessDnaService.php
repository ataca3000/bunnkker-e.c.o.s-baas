<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Application\Services;

use Illuminate\Support\Str;
use Modules\Core\BusinessAttribution\Domain\Models\BusinessDna;

/**
 * Business DNA Engine — creates and updates Business DNA for any entity.
 */
final class BusinessDnaService
{
    /**
     * Get or create a DNA record for the given entity.
     *
     * @param  array<string, mixed>  $defaults
     */
    public function getOrCreate(string $entityType, string $entityId, array $defaults = []): BusinessDna
    {
        /** @var BusinessDna $dna */
        $dna = BusinessDna::firstOrCreate(
            ['entity_type' => $entityType, 'entity_id' => $entityId],
            array_merge(['id' => Str::uuid()->toString()], $defaults),
        );

        return $dna;
    }

    /**
     * Update attribution fields for an existing DNA record.
     *
     * @param  array<string, mixed>  $data
     */
    public function update(string $dnaId, array $data): BusinessDna
    {
        $dna = BusinessDna::findOrFail($dnaId);
        $dna->update($data);

        return $dna;
    }

    /**
     * Attach marketing attribution (initiative / campaign / ad set / ad / creative).
     *
     * @param  array<string, mixed>  $attribution
     */
    public function attachMarketing(string $dnaId, array $attribution): BusinessDna
    {
        return $this->update($dnaId, array_filter([
            'initiative_id' => $attribution['initiative_id'] ?? null,
            'campaign_id' => $attribution['campaign_id'] ?? null,
            'ad_set_id' => $attribution['ad_set_id'] ?? null,
            'ad_id' => $attribution['ad_id'] ?? null,
            'creative_id' => $attribution['creative_id'] ?? null,
            'landing_page' => $attribution['landing_page'] ?? null,
            'lead_source' => $attribution['lead_source'] ?? null,
            'origin_provider' => $attribution['origin_provider'] ?? null,
            'origin_platform' => $attribution['origin_platform'] ?? null,
        ], static fn ($v) => $v !== null));
    }

    /**
     * Set the first-touch record (only if not already set).
     *
     * @param  array<string, mixed>  $touch
     */
    public function recordFirstTouch(string $dnaId, array $touch): BusinessDna
    {
        $dna = BusinessDna::findOrFail($dnaId);

        if ($dna->first_touch === null) {
            $dna->update(['first_touch' => $touch]);
        }

        return $dna;
    }

    /**
     * Update the last-touch record (always overwritten).
     *
     * @param  array<string, mixed>  $touch
     */
    public function recordLastTouch(string $dnaId, array $touch): BusinessDna
    {
        return $this->update($dnaId, ['last_touch' => $touch]);
    }

    public function markAcquired(string $dnaId, string $timestamp): BusinessDna
    {
        return $this->update($dnaId, ['acquisition_timestamp' => $timestamp]);
    }

    public function markConverted(string $dnaId, string $timestamp): BusinessDna
    {
        return $this->update($dnaId, ['conversion_timestamp' => $timestamp]);
    }

    public function markRepeatPurchase(string $dnaId, string $timestamp): BusinessDna
    {
        return $this->update($dnaId, ['repeat_purchase_timestamp' => $timestamp]);
    }

    public function getForEntity(string $entityType, string $entityId): ?BusinessDna
    {
        return BusinessDna::where('entity_type', $entityType)
            ->where('entity_id', $entityId)
            ->with(['journeySteps', 'metrics'])
            ->first();
    }
}
