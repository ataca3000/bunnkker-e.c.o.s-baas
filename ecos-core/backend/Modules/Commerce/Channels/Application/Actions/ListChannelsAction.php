<?php

declare(strict_types=1);

namespace Modules\Commerce\Channels\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Commerce\Channels\Domain\Contracts\ChannelRepositoryInterface;

final class ListChannelsAction extends BaseAction
{
    public function __construct(private readonly ChannelRepositoryInterface $channels) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $filters = is_array($arguments[0] ?? null) ? $arguments[0] : [];

        return OperationResult::success($this->channels->paginate($filters));
    }
}
