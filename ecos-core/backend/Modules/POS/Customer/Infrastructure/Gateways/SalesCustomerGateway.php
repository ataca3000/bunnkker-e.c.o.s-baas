<?php

declare(strict_types=1);

namespace Modules\POS\Customer\Infrastructure\Gateways;

use DateTimeImmutable;
use DateTimeZone;
use Modules\POS\Customer\Domain\Contracts\CustomerGatewayInterface;
use Modules\POS\Customer\Domain\Exceptions\CustomerNotFoundException;
use Modules\POS\Customer\Domain\ValueObjects\CustomerSnapshot;
use Modules\Sales\Customers\Domain\Models\Customer;

final class SalesCustomerGateway implements CustomerGatewayInterface
{
    public function findById(string $customerId): CustomerSnapshot
    {
        $customer = Customer::find($customerId);

        if ($customer === null || ! $customer->is_active) {
            throw CustomerNotFoundException::withId($customerId);
        }

        return $this->toSnapshot($customer);
    }

    public function findByPhone(string $phone): CustomerSnapshot
    {
        $customer = Customer::where('phone', $phone)
            ->orWhere('mobile', $phone)
            ->where('is_active', true)
            ->first();

        if ($customer === null) {
            throw CustomerNotFoundException::withPhone($phone);
        }

        return $this->toSnapshot($customer);
    }

    public function findByEmail(string $email): CustomerSnapshot
    {
        $customer = Customer::where('email', $email)
            ->where('is_active', true)
            ->first();

        if ($customer === null) {
            throw CustomerNotFoundException::withEmail($email);
        }

        return $this->toSnapshot($customer);
    }

    public function findByCode(string $code): CustomerSnapshot
    {
        $customer = Customer::where('code', $code)
            ->where('is_active', true)
            ->first();

        if ($customer === null) {
            throw CustomerNotFoundException::withCode($code);
        }

        return $this->toSnapshot($customer);
    }

    private function toSnapshot(Customer $customer): CustomerSnapshot
    {
        return CustomerSnapshot::capture(
            customerId: (string) $customer->id,
            customerCode: (string) ($customer->code ?? ''),
            name: (string) $customer->name,
            email: $customer->email ?: null,
            phone: $customer->phone ?: ($customer->mobile ?: null),
            capturedAt: new DateTimeImmutable('now', new DateTimeZone('UTC')),
        );
    }
}
