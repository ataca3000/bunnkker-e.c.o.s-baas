<?php

declare(strict_types=1);

namespace Modules\Hr\Workforce\Domain\Policies;

use Modules\Hr\Workforce\Domain\Models\Employee;

/**
 * Record-level rules for employee data.
 *
 * ┌─ PERMISSIONS SAY WHAT · POLICIES SAY WHICH ─────────────────────────────┐
 * │ Route middleware already answers "may this user manage employees at all".   │
 * │ What it cannot answer is "may they manage THIS one". Two rules matter:      │
 * │ records never cross a company boundary, and nobody ends their own           │
 * │ employment or approves their own file.                                     │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class EmployeePolicy
{
    public function view(mixed $user, Employee $employee): bool
    {
        return $this->sameCompany($user, $employee);
    }

    public function update(mixed $user, Employee $employee): bool
    {
        return $this->sameCompany($user, $employee);
    }

    /** Nobody terminates themselves — that decision belongs to someone else. */
    public function terminate(mixed $user, Employee $employee): bool
    {
        if (! $this->sameCompany($user, $employee)) {
            return false;
        }

        return ! $this->isSelf($user, $employee);
    }

    /** Managing your own reporting line would let you choose your own manager. */
    public function manageReportingLine(mixed $user, Employee $employee): bool
    {
        if (! $this->sameCompany($user, $employee)) {
            return false;
        }

        return ! $this->isSelf($user, $employee);
    }

    private function sameCompany(mixed $user, Employee $employee): bool
    {
        return $user !== null
            && (string) ($user->company_id ?? '') !== ''
            && (string) $user->company_id === (string) $employee->company_id;
    }

    private function isSelf(mixed $user, Employee $employee): bool
    {
        return $user !== null
            && $employee->user_id !== null
            && (int) $employee->user_id === (int) $user->id;
    }
}
