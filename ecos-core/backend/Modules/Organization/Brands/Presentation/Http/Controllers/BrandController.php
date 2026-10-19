<?php

declare(strict_types=1);

namespace Modules\Organization\Brands\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Organization\Brands\Application\Actions\CreateBrandAction;
use Modules\Organization\Brands\Application\Actions\DeleteBrandAction;
use Modules\Organization\Brands\Application\Actions\GetBrandAction;
use Modules\Organization\Brands\Application\Actions\ListBrandsAction;
use Modules\Organization\Brands\Application\Actions\UpdateBrandAction;
use Modules\Organization\Brands\Application\DTO\BrandDTO;
use Modules\Organization\Brands\Application\Services\BrandTransferAnalysisService;
use Modules\Organization\Brands\Application\Services\BrandTransferService;
use Modules\Organization\Brands\Domain\Exceptions\BrandNotFoundException;
use Modules\Organization\Brands\Presentation\Http\Requests\BrandTransferAnalyzeRequest;
use Modules\Organization\Brands\Presentation\Http\Requests\BrandTransferRequest;
use Modules\Organization\Brands\Presentation\Http\Requests\StoreBrandRequest;
use Modules\Organization\Brands\Presentation\Http\Requests\UpdateBrandRequest;
use Modules\Organization\Brands\Presentation\Http\Resources\BrandResource;
use RuntimeException;

final class BrandController extends Controller
{
    use HasApiResponse;

    public function index(Request $request, ListBrandsAction $action): JsonResponse
    {
        $companyId = $request->query('company_id');

        $paginator = $action->execute([
            'search' => $request->query('search'),
            'company_id' => $companyId,
            'status' => $request->query('status', 'all'),
            'sort_by' => $request->query('sort_by', 'created_at'),
            'sort_dir' => $request->query('sort_dir', 'desc'),
            'per_page' => $request->query('per_page', 10),
        ])->data();

        $totalActiveChannels = Channel::query()
            ->where('is_active', true)
            ->when(
                $companyId,
                fn ($q) => $q->whereHas('brand', fn ($q) => $q->where('company_id', $companyId)),
            )
            ->count();

        return $this->success([
            'items' => BrandResource::collection($paginator->items()),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
            'summary' => [
                'total_active_channels' => $totalActiveChannels,
            ],
        ]);
    }

    public function show(string $brand, GetBrandAction $action): JsonResponse
    {
        try {
            $model = $action->execute($brand)->data();

            return $this->success(new BrandResource($model));
        } catch (BrandNotFoundException $e) {
            return $this->error($e->getMessage(), 404);
        }
    }

    public function store(StoreBrandRequest $request, CreateBrandAction $action): JsonResponse
    {
        $result = $action->execute(BrandDTO::fromArray($request->validated()));

        return $this->created(new BrandResource($result->data()), $result->message());
    }

    public function update(UpdateBrandRequest $request, string $brand, UpdateBrandAction $action): JsonResponse
    {
        try {
            $result = $action->execute($brand, BrandDTO::fromArray($request->validated()));

            return $this->updated(new BrandResource($result->data()), $result->message());
        } catch (BrandNotFoundException $e) {
            return $this->error($e->getMessage(), 404);
        }
    }

    public function destroy(string $brand, DeleteBrandAction $action): JsonResponse
    {
        try {
            $result = $action->execute($brand);

            return $this->deleted($result->message() ?? 'Brand deleted successfully.');
        } catch (BrandNotFoundException $e) {
            return $this->error($e->getMessage(), 404);
        }
    }

    public function analyze(
        BrandTransferAnalyzeRequest $request,
        string $brand,
        GetBrandAction $get,
        BrandTransferAnalysisService $analysis,
    ): JsonResponse {
        try {
            $model = $get->execute($brand)->data();
            $report = $analysis->analyze($model, $request->string('target_company_id')->value());

            return $this->success($report->toArray(), 'Impact analysis complete.');
        } catch (BrandNotFoundException $e) {
            return $this->error($e->getMessage(), 404);
        }
    }

    public function transfer(
        BrandTransferRequest $request,
        string $brand,
        GetBrandAction $get,
        BrandTransferService $service,
        BrandTransferAnalysisService $analysis,
    ): JsonResponse {
        try {
            $model = $get->execute($brand)->data();
            $actorId = (string) (Auth::id() ?? '');
            $targetId = $request->string('target_company_id')->value();

            // Run analysis to attach to the audit log and surface blocker errors.
            $report = $analysis->analyze($model, $targetId);

            if ($report->hasBlockers()) {
                $msg = $report->codeConflict
                    ? "Transfer blocked: brand code \"{$model->code}\" already exists in the target company. Codes are permanent business identifiers and cannot be auto-renamed. Rename this brand's code before retrying the transfer."
                    : 'Transfer blocked: one or more blocking issues were detected.';

                return $this->error($msg, 409);
            }

            $transfer = $service->execute($model, $targetId, $actorId, $report);

            return $this->success([
                'brand' => new BrandResource($model->fresh()->load('company')),
                'transfer' => $transfer,
            ], 'Brand transferred successfully.');
        } catch (BrandNotFoundException $e) {
            return $this->error($e->getMessage(), 404);
        } catch (RuntimeException $e) {
            $isConflict = str_contains($e->getMessage(), 'Transfer blocked');

            return $this->error($e->getMessage(), $isConflict ? 409 : 422);
        }
    }
}
