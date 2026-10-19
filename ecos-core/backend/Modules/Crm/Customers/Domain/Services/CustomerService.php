<?php

declare(strict_types=1);

namespace Modules\Crm\Customers\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Crm\Customers\Domain\Enums\CustomerStatus;
use Modules\Crm\Customers\Domain\Enums\CustomerType;
use Modules\Crm\Customers\Domain\Events\CustomerArchived;
use Modules\Crm\Customers\Domain\Events\CustomerCreated;
use Modules\Crm\Customers\Domain\Events\CustomerRestored;
use Modules\Crm\Customers\Domain\Events\CustomerUpdated;
use Modules\Crm\Customers\Domain\Exceptions\CustomerException;
use Modules\Crm\Customers\Domain\Models\Customer;
use Modules\Crm\Customers\Domain\Models\CustomerAddress;
use Modules\Crm\Customers\Domain\Models\CustomerDocument;
use Modules\Crm\Customers\Domain\Models\CustomerEmail;
use Modules\Crm\Customers\Domain\Models\CustomerNote;
use Modules\Crm\Customers\Domain\Models\CustomerPhone;
use Modules\Crm\Customers\Domain\Models\CustomerPreference;
use Modules\Crm\Customers\Domain\Models\CustomerTag;

/**
 * The Customer master service — the single writer of customer identity.
 *
 * ┌─ IDENTITY LIVES HERE · MIRRORED FOR BACKWARD COMPATIBILITY ─────────────┐
 * │ Creates and edits individuals and businesses, their contacts, addresses,  │
 * │ tags, notes, documents and preferences on the ONE `customers` master.      │
 * │ The primary phone/email are mirrored to the legacy columns so existing     │
 * │ lookups keep resolving — one identity, never a duplicate. It writes only   │
 * │ customer-owned tables; it imports no operational module.                   │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class CustomerService
{
    /**
     * Create an individual or business customer.
     *
     * @param  array<string, mixed>  $data
     */
    public function create(string $companyId, CustomerType $type, array $data, ?int $actorId = null): Customer
    {
        $name = $this->resolveName($type, $data);
        $status = isset($data['status']) ? CustomerStatus::from((string) $data['status']) : CustomerStatus::Active;

        return DB::transaction(function () use ($companyId, $type, $data, $name, $status, $actorId): Customer {
            $customer = Customer::create([
                'company_id' => $companyId,
                'code' => $this->uniqueCode(),
                'name' => $name,
                'customer_type' => $type->value,
                'first_name' => $data['first_name'] ?? null,
                'last_name' => $data['last_name'] ?? null,
                'business_name' => $data['business_name'] ?? null,
                'tax_registration_number' => $data['tax_registration_number'] ?? null,
                'contact_person' => $data['contact_person'] ?? null,
                'status' => $status->value,
                'is_active' => $status->isActiveFlag(),
                'customer_group_id' => $data['customer_group_id'] ?? null,
                'preferred_language' => $data['preferred_language'] ?? null,
                'preferred_contact_method' => $data['preferred_contact_method'] ?? null,
                'country' => $data['country'] ?? null,
                'city' => $data['city'] ?? null,
                'notes' => $data['notes'] ?? null,
            ]);

            if (! empty($data['phone'])) {
                $this->addPhone($customer, (string) $data['phone'], $data['phone_label'] ?? 'mobile', true);
            }
            if (! empty($data['email'])) {
                $this->addEmail($customer, (string) $data['email'], $data['email_label'] ?? 'primary', true);
            }

            $fresh = $customer->refresh();

            // Published after commit so a rolled-back creation announces nothing.
            DB::afterCommit(static fn () => event(new CustomerCreated(
                companyId: (string) $fresh->company_id,
                customerId: (string) $fresh->id,
                customerType: $type->value,
                displayName: $fresh->name !== null ? (string) $fresh->name : null,
                actorId: $actorId,
            )));

            return $fresh;
        });
    }

    /** @param array<string, mixed> $data */
    public function update(Customer $customer, array $data): Customer
    {
        $fields = array_intersect_key($data, array_flip([
            'first_name', 'last_name', 'business_name', 'tax_registration_number', 'contact_person',
            'customer_group_id', 'preferred_language', 'preferred_contact_method', 'country', 'city', 'notes',
        ]));

        $customer->fill($fields);
        // Keep the display name coherent with the structured fields.
        $customer->name = $this->resolveName($customer->customer_type, array_merge($customer->only(['first_name', 'last_name', 'business_name']), $data));

        // Captured before save, while the model still knows what moved. The
        // event names the changed fields rather than shipping the record, so a
        // consumer can decide whether it cares without diffing anything.
        $changed = array_keys($customer->getDirty());

        $customer->save();
        $fresh = $customer->refresh();

        if ($changed !== []) {
            DB::afterCommit(static fn () => event(new CustomerUpdated(
                companyId: (string) $fresh->company_id,
                customerId: (string) $fresh->id,
                changedFields: $changed,
            )));
        }

        return $fresh;
    }

    public function setStatus(Customer $customer, CustomerStatus $status): Customer
    {
        // status is enum-cast on the model, so read its value rather than casting.
        $previous = $customer->status instanceof CustomerStatus
            ? $customer->status->value
            : ($customer->status !== null ? (string) $customer->status : null);

        $customer->update(['status' => $status->value, 'is_active' => $status->isActiveFlag()]);
        $fresh = $customer->refresh();

        // Archiving and restoring are the two status moves anything downstream
        // reacts to; the rest are internal lifecycle detail and stay quiet.
        $event = match (true) {
            $status === CustomerStatus::Archived && $previous !== CustomerStatus::Archived->value => new CustomerArchived(
                companyId: (string) $fresh->company_id,
                customerId: (string) $fresh->id,
                previousStatus: $previous,
            ),
            $previous === CustomerStatus::Archived->value && $status !== CustomerStatus::Archived => new CustomerRestored(
                companyId: (string) $fresh->company_id,
                customerId: (string) $fresh->id,
                previousStatus: $previous,
            ),
            default => null,
        };

        if ($event !== null) {
            DB::afterCommit(static fn () => event($event));
        }

        return $fresh;
    }

    // ── Contacts ────────────────────────────────────────────────────────────────

    public function addPhone(Customer $customer, string $phone, string $label = 'mobile', bool $primary = false): CustomerPhone
    {
        return DB::transaction(function () use ($customer, $phone, $label, $primary): CustomerPhone {
            $makePrimary = $primary || $customer->phones()->count() === 0;
            if ($makePrimary) {
                $customer->phones()->update(['is_primary' => false]);
            }

            $row = $customer->phones()->create(['label' => $label, 'phone' => $phone, 'is_primary' => $makePrimary]);

            if ($makePrimary) {
                $customer->update(['phone' => $phone]); // mirror to legacy column
            }

            return $row;
        });
    }

    public function addEmail(Customer $customer, string $email, string $label = 'primary', bool $primary = false): CustomerEmail
    {
        return DB::transaction(function () use ($customer, $email, $label, $primary): CustomerEmail {
            $makePrimary = $primary || $customer->emails()->count() === 0;
            if ($makePrimary) {
                $customer->emails()->update(['is_primary' => false]);
            }

            $row = $customer->emails()->create(['label' => $label, 'email' => $email, 'is_primary' => $makePrimary]);

            if ($makePrimary) {
                $customer->update(['email' => $email]);
            }

            return $row;
        });
    }

    // ── Addresses (reuse the existing customer_addresses table) ─────────────────

    /** @param array<string, mixed> $data */
    public function addAddress(Customer $customer, array $data, bool $default = false): CustomerAddress
    {
        return DB::transaction(function () use ($customer, $data, $default): CustomerAddress {
            $makeDefault = $default || $customer->addresses()->count() === 0;
            if ($makeDefault) {
                $customer->addresses()->update(['is_default' => false]);
            }

            return $customer->addresses()->create(array_merge(
                array_intersect_key($data, array_flip([
                    'label', 'governorate', 'city', 'area', 'address_line', 'building', 'floor',
                    'apartment', 'landmark', 'address_notes', 'google_maps_lat', 'google_maps_lng', 'google_maps_url', 'location_source',
                ])),
                ['is_default' => $makeDefault],
            ));
        });
    }

    public function setDefaultAddress(Customer $customer, string $addressId): void
    {
        DB::transaction(function () use ($customer, $addressId): void {
            $customer->addresses()->update(['is_default' => false]);
            $customer->addresses()->whereKey($addressId)->update(['is_default' => true]);
        });
    }

    // ── Tags / notes / documents / preferences ──────────────────────────────────

    public function assignTag(Customer $customer, string $tagName, ?string $color = null): CustomerTag
    {
        $tag = CustomerTag::query()->firstOrCreate(
            ['company_id' => $customer->company_id, 'name' => $tagName],
            ['color' => $color],
        );
        $customer->tags()->syncWithoutDetaching([$tag->id]);

        return $tag;
    }

    public function removeTag(Customer $customer, string $tagId): void
    {
        $customer->tags()->detach($tagId);
    }

    public function addNote(Customer $customer, string $body, bool $pinned = false, ?int $authorId = null): CustomerNote
    {
        return $customer->customerNotes()->create(['body' => $body, 'is_pinned' => $pinned, 'author_id' => $authorId]);
    }

    /** @param array<string, mixed> $data */
    public function addDocument(Customer $customer, array $data, ?int $uploadedBy = null): CustomerDocument
    {
        return $customer->documents()->create([
            'name' => $data['name'],
            'doc_type' => $data['doc_type'] ?? null,
            'file_path' => $data['file_path'],
            'mime_type' => $data['mime_type'] ?? null,
            'size_bytes' => $data['size_bytes'] ?? null,
            'uploaded_by' => $uploadedBy,
        ]);
    }

    public function setPreference(Customer $customer, string $key, ?string $value): CustomerPreference
    {
        return CustomerPreference::query()->updateOrCreate(
            ['customer_id' => $customer->id, 'key' => $key],
            ['value' => $value],
        );
    }

    // ── Archive ─────────────────────────────────────────────────────────────────

    public function archive(Customer $customer, ?int $actorId = null): Customer
    {
        if ($customer->isArchived()) {
            throw CustomerException::alreadyArchived($customer->displayName());
        }

        $customer->update([
            'status' => CustomerStatus::Archived->value,
            'is_active' => false,
            'archived_at' => Carbon::now(),
            'archived_by' => $actorId,
        ]);

        return $customer->refresh();
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /** @param array<string, mixed> $data */
    private function resolveName(CustomerType $type, array $data): string
    {
        if ($type === CustomerType::Business) {
            $name = trim((string) ($data['business_name'] ?? ''));
            if ($name === '') {
                throw CustomerException::businessNameRequired();
            }

            return $name;
        }

        $name = trim(((string) ($data['first_name'] ?? '')).' '.((string) ($data['last_name'] ?? '')));
        if ($name === '') {
            $name = trim((string) ($data['name'] ?? ''));
        }
        if ($name === '') {
            throw CustomerException::individualNameRequired();
        }

        return $name;
    }

    private function uniqueCode(): string
    {
        do {
            $code = 'CUST-'.strtoupper(substr(str_replace('-', '', (string) Str::uuid()), 0, 8));
        } while (Customer::withTrashed()->where('code', $code)->exists());

        return $code;
    }
}
