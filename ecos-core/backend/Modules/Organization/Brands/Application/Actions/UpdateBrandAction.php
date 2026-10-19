<?php

declare(strict_types=1);

namespace Modules\Organization\Brands\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Modules\Admin\Configuration\Domain\Services\ConfigurationManager;
use Modules\Organization\Brands\Application\DTO\BrandDTO;
use Modules\Organization\Brands\Domain\Contracts\BrandRepositoryInterface;
use Modules\Organization\Brands\Domain\Exceptions\BrandNotFoundException;

final class UpdateBrandAction extends BaseAction
{
    public function __construct(
        private readonly BrandRepositoryInterface $brands,
        private readonly ConfigurationManager $config,
    ) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $id = $arguments[0] ?? null;
        $dto = $arguments[1] ?? null;

        if (! is_string($id) || ! $dto instanceof BrandDTO) {
            throw new InvalidArgumentException('UpdateBrandAction::execute expects (string $id, BrandDTO $dto).');
        }

        $brand = $this->brands->findById($id);
        if ($brand === null) {
            throw new BrandNotFoundException($id);
        }

        $slug = $dto->slug ?? Str::slug($dto->name);
        $baseSlug = $slug;
        $counter = 1;
        while ($this->brands->existsBySlug($brand->company_id, $slug, $id)) {
            $slug = $baseSlug.'-'.$counter++;
        }

        // default_target_margin is intentionally excluded — it is managed exclusively
        // through Configuration OS (the canonical source). BrandPolicyUpdatedListener
        // syncs the Config OS value back into this column as a projection.
        $attributes = [
            'name' => $dto->name,
            'slug' => $slug,
            'logo' => $dto->logo,
            'description' => $dto->description,
            'is_active' => $dto->is_active,
            'default_markup' => $dto->default_markup,
            'default_discount_pct' => $dto->default_discount_pct,
        ];

        if ($dto->code !== null) {
            $attributes['code'] = $dto->code;
        }

        $brand = $this->brands->update($brand, $attributes);

        // When margin is provided via Brand page, write through to Config OS.
        // BrandPolicyUpdated fires → BrandPolicyUpdatedListener updates brands.default_target_margin.
        if ($dto->default_target_margin !== null) {
            $this->config->updateBrandPolicy(
                brandId: $brand->id,
                companyId: (string) $brand->company_id,
                group: 'pricing',
                settings: ['minimum_margin_pct' => $dto->default_target_margin],
                actorId: (string) (Auth::id() ?? ''),
                reason: 'Updated via Brand page',
            );
        }

        return OperationResult::success($brand->fresh(), 'Brand updated successfully.');
    }
}
