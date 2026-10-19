<?php

declare(strict_types=1);

namespace Modules\Commerce\Synchronization\Application\Observers;

use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Commerce\Synchronization\Application\Jobs\CustomerSyncJob;
use Modules\Sales\Customers\Domain\Models\Customer;

final class CustomerObserver
{
    public function created(Customer $customer): void
    {
        $this->dispatch($customer);
    }

    public function updated(Customer $customer): void
    {
        $this->dispatch($customer);
    }

    private function dispatch(Customer $customer): void
    {
        Channel::query()
            ->with('credential')
            ->where('is_active', true)
            ->where('sync_customers', true)
            ->get()
            ->each(function (Channel $channel) use ($customer): void {
                CustomerSyncJob::dispatch($channel, $customer);
            });
    }
}
