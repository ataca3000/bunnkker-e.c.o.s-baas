<?php

declare(strict_types=1);

namespace Modules\IAM\Application\Services;

use App\Models\User;

/**
 * Manages profile preferences and employment information (ADR-040). Backend-authoritative
 * preferences (locale/timezone/formats); frontend-only UI prefs (theme/landing/dashboard)
 * stay client-side per the ADR-039 map.
 */
class UserProfileService
{
    private const PREFERENCE_FIELDS = [
        'locale', 'timezone', 'date_format', 'number_format', 'currency_preference', 'signature', 'notes',
    ];

    private const EMPLOYMENT_FIELDS = [
        'job_title', 'employment_type', 'manager_id', 'hire_date', 'termination_date',
    ];

    public function __construct(private readonly UserAuditService $audit) {}

    /**
     * @param  array<string,mixed>  $data
     */
    public function updatePreferences(User $user, array $data): User
    {
        $old = $user->only(self::PREFERENCE_FIELDS);
        $user->fill(array_intersect_key($data, array_flip(self::PREFERENCE_FIELDS)));
        $user->save();

        $this->audit->log('preferences_updated', $user, $old, $user->only(self::PREFERENCE_FIELDS));

        return $user;
    }

    /**
     * @param  array<string,mixed>  $data
     */
    public function updateEmployment(User $user, array $data): User
    {
        $old = $user->only(self::EMPLOYMENT_FIELDS);
        $user->fill(array_intersect_key($data, array_flip(self::EMPLOYMENT_FIELDS)));
        $user->save();

        $this->audit->log('employment_updated', $user, $old, $user->only(self::EMPLOYMENT_FIELDS));

        return $user;
    }
}
