<?php

declare(strict_types=1);

namespace Modules\Crm\Customers\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Crm\Customers\Domain\Services\CustomerService;
use Modules\Crm\Customers\Presentation\Http\Controllers\Concerns\ResolvesCustomerContext;

/**
 * Customer sub-resources — phones, emails, addresses, tags, notes, documents and
 * preferences. All keyed to the one customer master; the primary phone/email are
 * mirrored to the legacy columns by the service.
 */
class CustomerContactController extends Controller
{
    use ResolvesCustomerContext;

    public function __construct(private readonly CustomerService $customers) {}

    public function addPhone(Request $request, string $id): JsonResponse
    {
        $v = $request->validate([
            'phone' => ['required', 'string', 'max:40'],
            'label' => ['nullable', 'string', 'max:30'],
            'is_primary' => ['nullable', 'boolean'],
        ]);
        $row = $this->customers->addPhone($this->customer($request, $id), $v['phone'], $v['label'] ?? 'mobile', (bool) ($v['is_primary'] ?? false));

        return response()->json(['data' => ['id' => $row->id, 'phone' => $row->phone, 'is_primary' => (bool) $row->is_primary]], 201);
    }

    public function addEmail(Request $request, string $id): JsonResponse
    {
        $v = $request->validate([
            'email' => ['required', 'email', 'max:200'],
            'label' => ['nullable', 'string', 'max:30'],
            'is_primary' => ['nullable', 'boolean'],
        ]);
        $row = $this->customers->addEmail($this->customer($request, $id), $v['email'], $v['label'] ?? 'primary', (bool) ($v['is_primary'] ?? false));

        return response()->json(['data' => ['id' => $row->id, 'email' => $row->email, 'is_primary' => (bool) $row->is_primary]], 201);
    }

    public function addAddress(Request $request, string $id): JsonResponse
    {
        $v = $request->validate([
            'label' => ['nullable', 'string', 'max:30'],
            'governorate' => ['nullable', 'string', 'max:120'],
            'city' => ['nullable', 'string', 'max:120'],
            'area' => ['nullable', 'string', 'max:120'],
            'address_line' => ['nullable', 'string', 'max:500'],
            'building' => ['nullable', 'string', 'max:60'],
            'floor' => ['nullable', 'string', 'max:60'],
            'apartment' => ['nullable', 'string', 'max:60'],
            'landmark' => ['nullable', 'string', 'max:200'],
            'address_notes' => ['nullable', 'string', 'max:500'],
            'is_default' => ['nullable', 'boolean'],
        ]);
        $row = $this->customers->addAddress($this->customer($request, $id), $v, (bool) ($v['is_default'] ?? false));

        return response()->json(['data' => ['id' => $row->id, 'is_default' => (bool) $row->is_default]], 201);
    }

    public function setDefaultAddress(Request $request, string $id, string $addressId): JsonResponse
    {
        $this->customers->setDefaultAddress($this->customer($request, $id), $addressId);

        return response()->json(['message' => 'Default address updated.']);
    }

    public function assignTag(Request $request, string $id): JsonResponse
    {
        $v = $request->validate(['name' => ['required', 'string', 'max:80'], 'color' => ['nullable', 'string', 'max:20']]);
        $tag = $this->customers->assignTag($this->customer($request, $id), $v['name'], $v['color'] ?? null);

        return response()->json(['data' => ['id' => $tag->id, 'name' => $tag->name]], 201);
    }

    public function removeTag(Request $request, string $id, string $tagId): JsonResponse
    {
        $this->customers->removeTag($this->customer($request, $id), $tagId);

        return response()->json(['message' => 'Tag removed.']);
    }

    public function addNote(Request $request, string $id): JsonResponse
    {
        $v = $request->validate(['body' => ['required', 'string'], 'is_pinned' => ['nullable', 'boolean']]);
        $note = $this->customers->addNote($this->customer($request, $id), $v['body'], (bool) ($v['is_pinned'] ?? false), $this->actorId($request));

        return response()->json(['data' => ['id' => $note->id]], 201);
    }

    public function addDocument(Request $request, string $id): JsonResponse
    {
        $v = $request->validate([
            'name' => ['required', 'string', 'max:200'],
            'file_path' => ['required', 'string', 'max:500'],
            'doc_type' => ['nullable', 'string', 'max:40'],
            'mime_type' => ['nullable', 'string', 'max:120'],
            'size_bytes' => ['nullable', 'integer'],
        ]);
        $doc = $this->customers->addDocument($this->customer($request, $id), $v, $this->actorId($request));

        return response()->json(['data' => ['id' => $doc->id, 'name' => $doc->name]], 201);
    }

    public function setPreference(Request $request, string $id): JsonResponse
    {
        $v = $request->validate(['key' => ['required', 'string', 'max:80'], 'value' => ['nullable', 'string', 'max:500']]);
        $pref = $this->customers->setPreference($this->customer($request, $id), $v['key'], $v['value'] ?? null);

        return response()->json(['data' => ['key' => $pref->key, 'value' => $pref->value]]);
    }
}
