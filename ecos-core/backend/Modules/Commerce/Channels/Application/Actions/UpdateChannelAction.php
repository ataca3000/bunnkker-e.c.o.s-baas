<?php

declare(strict_types=1);

namespace Modules\Commerce\Channels\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Commerce\Channels\Application\DTO\ChannelDTO;
use Modules\Commerce\Channels\Domain\Contracts\ChannelRepositoryInterface;
use Modules\Commerce\Channels\Domain\Exceptions\ChannelNotFoundException;

final class UpdateChannelAction extends BaseAction
{
    public function __construct(private readonly ChannelRepositoryInterface $channels) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $id = (string) ($arguments[0] ?? '');

        /** @var ChannelDTO $dto */
        $dto = $arguments[1];

        $channel = $this->channels->findById($id);

        if ($channel === null) {
            throw new ChannelNotFoundException($id);
        }

        $updated = $this->channels->update(
            $channel,
            $dto->channelAttributes(),
            $dto->credentialAttributes(),
        );

        return OperationResult::success($updated, 'Channel updated successfully.');
    }
}
