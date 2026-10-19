<?php

declare(strict_types=1);

namespace Modules\Commerce\Channels\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Commerce\Channels\Application\DTO\ChannelDTO;
use Modules\Commerce\Channels\Domain\Contracts\ChannelRepositoryInterface;
use Modules\Commerce\Channels\Domain\Services\SalesChannelCodeGeneratorService;

final class CreateChannelAction extends BaseAction
{
    public function __construct(
        private readonly ChannelRepositoryInterface $channels,
        private readonly SalesChannelCodeGeneratorService $codeGenerator,
    ) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        /** @var ChannelDTO $dto */
        $dto = $arguments[0];

        $code = $dto->code ?? $this->codeGenerator->next($dto->brand_id);

        $attributes = array_merge($dto->channelAttributes(), ['code' => $code]);

        $channel = $this->channels->create(
            $attributes,
            $dto->credentialAttributes(),
        );

        return OperationResult::success($channel, 'Channel created successfully.');
    }
}
