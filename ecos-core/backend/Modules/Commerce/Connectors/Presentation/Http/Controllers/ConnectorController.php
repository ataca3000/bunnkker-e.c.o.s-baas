<?php

declare(strict_types=1);

namespace Modules\Commerce\Connectors\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Modules\Commerce\Channels\Presentation\Http\Resources\ChannelResource;
use Modules\Commerce\Connectors\Application\Actions\TestConnectionAction;

final class ConnectorController extends Controller
{
    use HasApiResponse;

    public function testConnection(string $channel, TestConnectionAction $action): JsonResponse
    {
        $result = $action->execute($channel);

        return $this->success(new ChannelResource($result->data()), $result->message());
    }
}
