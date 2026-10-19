<?php

declare(strict_types=1);

namespace Modules\Commerce\Channels\Domain\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\Commerce\Channels\Domain\Models\Channel;

interface ChannelRepositoryInterface
{
    public function paginate(array $filters): LengthAwarePaginator;

    public function findById(string $id): ?Channel;

    /**
     * @param  array<string, mixed>  $attributes
     * @param  array<string, string>|null  $credentials
     */
    public function create(array $attributes, ?array $credentials): Channel;

    /**
     * @param  array<string, mixed>  $attributes
     * @param  array<string, string>|null  $credentials
     */
    public function update(Channel $channel, array $attributes, ?array $credentials): Channel;

    public function delete(Channel $channel): void;
}
