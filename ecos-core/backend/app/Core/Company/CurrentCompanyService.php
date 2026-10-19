<?php

declare(strict_types=1);

namespace App\Core\Company;

use Illuminate\Support\Facades\Auth;

/**
 * Resolves the company context for the currently authenticated user.
 *
 * Returns null for unauthenticated requests and for super-admins
 * (users with no company affiliation), allowing those callers unrestricted access.
 */
final class CurrentCompanyService
{
    /**
     * Returns the current user's company_id, or null if there is no company
     * context (super-admin, unauthenticated, or company_id not set on user).
     */
    public function id(): ?string
    {
        /** @var \App\Models\User|null $user */
        $user = Auth::user();

        if ($user === null) {
            return null;
        }

        $companyId = $user->company_id ?? null;

        return is_string($companyId) && $companyId !== '' ? $companyId : null;
    }
}
