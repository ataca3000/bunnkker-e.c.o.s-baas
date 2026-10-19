<?php

declare(strict_types=1);

namespace Modules\Manufacturing\BillsOfMaterials\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Manufacturing\BillsOfMaterials\Domain\Contracts\BomRepositoryInterface;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\BillOfMaterial;

/**
 * Activate or deactivate a recipe, and nothing else.
 *
 * This exists because BUG-BOM-DATA-LOSS-001 was only possible while a status
 * change travelled through the full update contract: a caller that omitted
 * `lines` silently deleted every component. Here there is no payload that could
 * carry lines at all, so the failure mode is unreachable rather than merely
 * guarded against.
 *
 * Passing null for lines relies on the repository contract established in the
 * same fix: null means "leave the existing lines untouched".
 */
final class SetBomStatusAction extends BaseAction
{
    public function __construct(private readonly BomRepositoryInterface $boms) {}

    /**
     * @param  mixed  ...$arguments  Expects (BillOfMaterial $bom, bool $isActive).
     */
    public function execute(mixed ...$arguments): mixed
    {
        /** @var BillOfMaterial $bom */
        $bom = $arguments[0];
        $isActive = (bool) $arguments[1];

        // product_id is required by the repository so it can deactivate the
        // product's other recipes when this one becomes active. It is read from
        // the record, never from the request.
        $updated = $this->boms->update(
            $bom,
            ['is_active' => $isActive, 'product_id' => (string) $bom->product_id],
            null,
        );

        return OperationResult::success(
            $updated,
            $isActive ? 'Recipe activated.' : 'Recipe deactivated.',
        );
    }
}
