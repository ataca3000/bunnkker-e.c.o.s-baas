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
use Modules\Organization\Brands\Domain\Services\BrandCodeGeneratorService;

final class CreateBrandAction extends BaseAction
{
    public function __construct(
        private readonly BrandRepositoryInterface $brands,
        private readonly BrandCodeGeneratorService $codeGenerator,
        private readonly ConfigurationManager $config,
    ) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $dto = $arguments[0] ?? null;

        if (! $dto instanceof BrandDTO) {
            throw new InvalidArgumentException('CreateBrandAction::execute expects a BrandDTO.');
        }

        $code = $dto->code ?? $this->codeGenerator->next($dto->company_id);
        $slug = $dto->slug ?? Str::slug($dto->name);

        $baseSlug = $slug;
        $counter = 1;
        while ($this->brands->existsBySlug($dto->company_id, $slug)) {
            $slug = $baseSlug.'-'.$counter++;
        }

        $brand = $this->brands->create([
            'company_id' => $dto->company_id,
            'code' => $code,
            'name' => $dto->name,
            'slug' => $slug,
            'logo' => $dto->logo,
            'description' => $dto->description,
            'is_active' => $dto->is_active,
            'default_target_margin' => $dto->default_target_margin,
            'default_markup' => $dto->default_markup,
            'default_discount_pct' => $dto->default_discount_pct,
        ]);

        // Seed the Config OS pricing policy so it is immediately in sync with the brand.
        if ($dto->default_target_margin !== null) {
            $this->config->updateBrandPolicy(
                brandId: $brand->id,
                companyId: (string) $dto->company_id,
                group: 'pricing',
                settings: ['minimum_margin_pct' => $dto->default_target_margin],
                actorId: (string) (Auth::id() ?? ''),
                reason: 'Seeded from brand creation',
            );
        }

        return OperationResult::success($brand, 'Brand created successfully.');
    }
}
