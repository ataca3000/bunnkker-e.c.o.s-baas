<?php

declare(strict_types=1);

namespace Modules\Organization\Brands\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use InvalidArgumentException;
use Modules\Organization\Brands\Domain\Contracts\BrandRepositoryInterface;
use Modules\Organization\Brands\Domain\Exceptions\BrandNotFoundException;

final class GetBrandAction extends BaseAction
{
    public function __construct(private readonly BrandRepositoryInterface $brands) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $id = $arguments[0] ?? null;

        if (! is_string($id)) {
            throw new InvalidArgumentException('GetBrandAction::execute expects a string id.');
        }

        $brand = $this->brands->findById($id);
        if ($brand === null) {
            throw new BrandNotFoundException($id);
        }

        return OperationResult::success($brand);
    }
}
