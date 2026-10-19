<?php

declare(strict_types=1);

namespace Modules\Commerce\Synchronization\Application\Services;

use Modules\Sales\Customers\Domain\Models\Customer;

/**
 * Handles inbound WooCommerce → ECOS customer synchronization.
 *
 * All Customer model mutations use withoutEvents() to prevent CustomerObserver
 * from dispatching a circular outbound CustomerSyncJob back to WooCommerce.
 */
final class WooCommerceCustomerSyncer
{
    /**
     * @param  array<string, mixed>  $payload
     * @return array{action: string, customer_id: string|null}
     */
    public function sync(array $payload): array
    {
        $billing = is_array($payload['billing'] ?? null) ? $payload['billing'] : [];
        $email = trim((string) ($billing['email'] ?? ($payload['email'] ?? '')));
        $firstName = trim((string) ($billing['first_name'] ?? ''));
        $lastName = trim((string) ($billing['last_name'] ?? ''));
        $name = trim("{$firstName} {$lastName}");

        if ($name === '') {
            $name = $email !== '' ? $email : 'WooCommerce Customer';
        }

        $phone = trim((string) ($billing['phone'] ?? ''));
        $city = trim((string) ($billing['city'] ?? ''));
        $country = trim((string) ($billing['country'] ?? ''));
        $address = trim((string) ($billing['address_1'] ?? ''));

        if ($email === '') {
            return ['action' => 'skipped_no_email', 'customer_id' => null];
        }

        $existing = Customer::query()->where('email', $email)->first();

        if ($existing !== null) {
            Customer::withoutEvents(function () use ($existing, $name, $phone, $city, $country, $address): void {
                $updates = ['name' => $name];

                if ($phone !== '') {
                    $updates['phone'] = $phone;
                }
                if ($city !== '') {
                    $updates['city'] = $city;
                }
                if ($country !== '') {
                    $updates['country'] = $country;
                }
                if ($address !== '') {
                    $updates['address'] = $address;
                }

                $existing->update($updates);
            });

            return ['action' => 'updated', 'customer_id' => $existing->id];
        }

        $created = Customer::withoutEvents(function () use ($email, $name, $phone, $city, $country, $address): Customer {
            return Customer::query()->create([
                'code' => $this->nextCustomerCode(),
                'name' => $name,
                'email' => $email,
                'phone' => $phone !== '' ? $phone : null,
                'city' => $city !== '' ? $city : null,
                'country' => $country !== '' ? $country : null,
                'address' => $address !== '' ? $address : null,
                'is_active' => true,
            ]);
        });

        return ['action' => 'created', 'customer_id' => $created->id];
    }

    private function nextCustomerCode(): string
    {
        $last = Customer::query()
            ->withTrashed()
            ->where('code', 'like', 'CUS-%')
            ->orderByRaw("CAST(REPLACE(code, 'CUS-', '') AS UNSIGNED) DESC")
            ->value('code');

        if ($last === null) {
            return 'CUS-001';
        }

        $current = (int) str_replace('CUS-', '', (string) $last);

        return 'CUS-'.str_pad((string) ($current + 1), 3, '0', STR_PAD_LEFT);
    }
}
