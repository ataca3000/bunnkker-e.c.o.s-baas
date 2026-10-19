<?php

declare(strict_types=1);

namespace Modules\Core\UserPreferences\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates the body of PUT /me/preferences/{category}.
 *
 * The `{category}` route segment is constrained at the route level
 * (`->where('category', '[a-z][a-z0-9._-]{0,149}')`) so invalid
 * category strings produce a 404 before this request is reached.
 *
 * The body must be a JSON object — the full preference payload for
 * that category. Key-level validation is the responsibility of the
 * consuming module in Phase 2.
 */
final class UpsertCategoryPreferencesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'payload' => ['required', 'array'],
            // Accept any string keys inside the payload — consuming modules
            // perform their own validation before writing preferences.
            'payload.*' => ['present'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'payload.required' => 'The preference payload is required.',
            'payload.array' => 'The preference payload must be a JSON object.',
        ];
    }
}
