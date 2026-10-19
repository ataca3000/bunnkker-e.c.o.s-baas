<?php

declare(strict_types=1);

namespace Modules\Commerce\ProductImport\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Modules\Commerce\ProductImport\Application\Actions\ImportProductsAction;

final class ProductImportController extends Controller
{
    use HasApiResponse;

    public function importProducts(string $channel, ImportProductsAction $action): JsonResponse
    {
        $result = $action->execute($channel);

        return $this->success($result->data(), $result->message());
    }
}
