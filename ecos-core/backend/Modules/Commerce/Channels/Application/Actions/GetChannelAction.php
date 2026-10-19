<?php

declare(strict_types=1);

namespace Modules\Commerce\Channels\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Commerce\Channels\Domain\Contracts\ChannelRepositoryInterface;
use Modules\Commerce\Channels\Domain\Exceptions\ChannelNotFoundException;

final class GetChannelAction extends BaseAction
{
    public function __construct(private readonly ChannelRepositoryInterface $channels) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $id = (string) ($arguments[0] ?? '');
        $channel = $this->channels->findById($id);

        if ($channel === null) {
            throw new ChannelNotFoundException($id);
        }

        return OperationResult::success($channel);
    }
}
