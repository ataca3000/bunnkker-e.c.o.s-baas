<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Application\Actions;

use Modules\Core\BusinessAttribution\Application\Services\BusinessDnaService;
use Modules\Core\BusinessAttribution\Domain\Models\BusinessDna;

/**
 * Create or update a Business DNA record for an entity.
 * Used by any module to register or enrich a business entity's attribution.
 */
final class AttachBusinessDnaAction
{
    public function __construct(
        private readonly BusinessDnaService $dnaService,
    ) {}

    /**
     * @param  array<string, mixed>  $dnaData
     */
    public function execute(
        string $entityType,
        string $entityId,
        array $dnaData = [],
    ): BusinessDna {
        $dna = $this->dnaService->getOrCreate($entityType, $entityId, $dnaData);

        // If extra enrichment data is provided after first create, update
        if ($dna->wasRecentlyCreated === false && ! empty($dnaData)) {
            $this->dnaService->update($dna->id, $dnaData);
            $dna->refresh();
        }

        return $dna;
    }
}
