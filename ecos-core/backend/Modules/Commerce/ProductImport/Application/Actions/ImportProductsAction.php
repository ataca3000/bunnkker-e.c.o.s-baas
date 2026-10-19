<?php

declare(strict_types=1);

namespace Modules\Commerce\ProductImport\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Commerce\Channels\Domain\Contracts\ChannelRepositoryInterface;
use Modules\Commerce\Channels\Domain\Exceptions\ChannelNotFoundException;
use Modules\Commerce\ProductImport\Application\Services\WooCommerceProductImporter;

final class ImportProductsAction extends BaseAction
{
    public function __construct(
        private readonly ChannelRepositoryInterface $channels,
        private readonly WooCommerceProductImporter $importer,
    ) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $channelId = (string) ($arguments[0] ?? '');
        $channel = $this->channels->findById($channelId);

        if ($channel === null) {
            throw new ChannelNotFoundException($channelId);
        }

        $result = $this->importer->import($channel);

        return OperationResult::success($result->toArray(), $result->summary());
    }
}
