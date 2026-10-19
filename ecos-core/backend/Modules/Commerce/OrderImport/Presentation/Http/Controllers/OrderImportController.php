<?php

declare(strict_types=1);

namespace Modules\Commerce\OrderImport\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Modules\Commerce\OrderImport\Application\Actions\ImportOrdersAction;

final class OrderImportController extends Controller
{
    use HasApiResponse;

    public function importOrders(string $channel, ImportOrdersAction $action): JsonResponse
    {
        $result = $action->execute($channel);

        return $this->success($result->data(), $result->message());
    }
}
