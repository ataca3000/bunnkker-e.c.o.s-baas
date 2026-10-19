<?php

declare(strict_types=1);

namespace Modules\Manufacturing\BillsOfMaterials\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Manufacturing\BillsOfMaterials\Domain\Contracts\BomRepositoryInterface;

final class ListBomsAction extends BaseAction
{
    public function __construct(private readonly BomRepositoryInterface $boms) {}

    /**
     * @param  mixed  ...$arguments  Expects a single array of filters.
     */
    public function execute(mixed ...$arguments): mixed
    {
        $filters = is_array($arguments[0] ?? null) ? $arguments[0] : [];

        return OperationResult::success($this->boms->paginate($filters));
    }
}
