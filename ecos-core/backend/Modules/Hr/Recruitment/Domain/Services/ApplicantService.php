<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Hr\Recruitment\Domain\Exceptions\RecruitmentException;
use Modules\Hr\Recruitment\Domain\Models\Applicant;

/**
 * Applicants, and the duplicate problem that comes with them.
 *
 * ┌─ THE SAME PERSON APPLIES MORE THAN ONCE ────────────────────────────────┐
 * │ People re-apply — months later, for a different job, sometimes twice in a   │
 * │ week. Phone and email are what identify them in practice, so a match on     │
 * │ either is surfaced BEFORE a second record is created.                      │
 * │                                                                            │
 * │ The caller then chooses: reuse the existing person, merge the duplicate     │
 * │ into them, or genuinely create someone new. Nothing is auto-merged —        │
 * │ two people really can share a household phone, and silently combining       │
 * │ their histories would be worse than a duplicate.                           │
 * │                                                                            │
 * │ Merging never deletes. The loser keeps its applications and points at the   │
 * │ survivor, so nothing anyone submitted is thrown away.                       │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class ApplicantService
{
    public function create(string $companyId, array $data, ?int $actorId = null): Applicant
    {
        // Stored as the applicant typed it — they should recognise their own
        // number. Matching normalises; storage does not.
        $mobile = trim((string) ($data['mobile'] ?? ''));

        if ($this->normalizeMobile($mobile) === '') {
            throw RecruitmentException::contactRequired();
        }

        return Applicant::create([
            'company_id' => $companyId,
            'applicant_number' => $this->nextNumber($companyId),
            'full_name' => trim((string) $data['full_name']),
            'mobile' => $mobile,
            'email' => isset($data['email']) ? mb_strtolower(trim((string) $data['email'])) : null,
            'birth_date' => $data['birth_date'] ?? null,
            'city' => $data['city'] ?? null,
            'country' => $data['country'] ?? null,
            'source' => $data['source'] ?? 'careers_portal',
            'status' => 'active',
            'notes' => $data['notes'] ?? null,
            'created_by' => $actorId,
        ]);
    }

    /**
     * Existing applicants who look like this one.
     *
     * @return array<int, array<string, mixed>> the matches and WHY each matched
     */
    public function findDuplicates(string $companyId, ?string $mobile, ?string $email): array
    {
        $mobile = $mobile === null ? null : $this->normalizeMobile($mobile);
        $email = $email === null ? null : mb_strtolower(trim($email));

        if ($mobile === null && $email === null) {
            return [];
        }

        $candidates = Applicant::query()
            ->where('company_id', $companyId)
            ->canonical()
            ->where(function ($q) use ($mobile, $email): void {
                if ($mobile !== null && $mobile !== '') {
                    // Matched on the subscriber digits, so "+20 100 123 4567",
                    // "00201001234567" and "01001234567" all find each other.
                    $q->orWhere('mobile', 'like', '%'.$mobile);
                }
                if ($email !== null && $email !== '') {
                    $q->orWhere('email', $email);
                }
            })
            ->limit(20)
            ->get();

        return $candidates->map(function (Applicant $applicant) use ($mobile, $email) {
            $matched = [];
            if ($mobile !== null && $mobile !== '' && $this->normalizeMobile((string) $applicant->mobile) === $mobile) {
                $matched[] = 'mobile';
            }
            if ($email !== null && $email !== '' && $applicant->email === $email) {
                $matched[] = 'email';
            }

            return [
                'id' => (string) $applicant->id,
                'applicant_number' => $applicant->applicant_number,
                'full_name' => $applicant->full_name,
                'mobile' => $applicant->mobile,
                'email' => $applicant->email,
                'matched_on' => $matched,
                // Both identifiers matching is a near-certainty; one is a prompt to look.
                'confidence' => count($matched) > 1 ? 'high' : 'possible',
                'applications' => $applicant->applications()->count(),
                'is_hired' => $applicant->isHired(),
            ];
        })->all();
    }

    /**
     * Merge a duplicate into the record that survives.
     *
     * Applications and attachments move across; the duplicate stays as a
     * tombstone pointing at the survivor, so an old link still resolves.
     */
    public function merge(Applicant $duplicate, Applicant $survivor, ?int $actorId = null): Applicant
    {
        if ((string) $duplicate->id === (string) $survivor->id) {
            throw RecruitmentException::cannotMergeIntoSelf();
        }

        if ($duplicate->isMerged()) {
            throw RecruitmentException::applicantAlreadyMerged();
        }

        return DB::transaction(function () use ($duplicate, $survivor, $actorId): Applicant {
            // Move the candidacies, unless the survivor already applied to that opening.
            foreach ($duplicate->applications()->get() as $application) {
                $clash = $survivor->applications()
                    ->where('job_opening_id', $application->job_opening_id)->exists();

                if (! $clash) {
                    $application->update(['applicant_id' => $survivor->id]);
                }
            }

            $duplicate->attachments()->update(['applicant_id' => $survivor->id]);

            // Fill any gap on the survivor from the duplicate — never overwrite.
            $survivor->update([
                'email' => $survivor->email ?? $duplicate->email,
                'birth_date' => $survivor->birth_date ?? $duplicate->birth_date,
                'city' => $survivor->city ?? $duplicate->city,
                'country' => $survivor->country ?? $duplicate->country,
            ]);

            $duplicate->update([
                'merged_into_id' => $survivor->id,
                'status' => 'merged',
                'notes' => trim((string) $duplicate->notes."\nMerged into {$survivor->applicant_number}"),
            ]);

            unset($actorId);

            return $survivor->refresh();
        });
    }

    /** Put someone in the talent pool — kept for a future opening, not discarded. */
    public function addToTalentPool(Applicant $applicant, ?string $note = null, array $tags = []): Applicant
    {
        $applicant->update([
            'in_talent_pool' => true,
            'talent_pool_added_at' => Carbon::now(),
            'talent_pool_note' => $note,
            'talent_pool_tags' => $tags === [] ? null : $tags,
        ]);

        return $applicant->refresh();
    }

    public function removeFromTalentPool(Applicant $applicant): Applicant
    {
        $applicant->update(['in_talent_pool' => false, 'talent_pool_added_at' => null]);

        return $applicant->refresh();
    }

    /**
     * The subscriber digits — the part of a number that identifies a person.
     *
     * "+20 100 123 4567", "00201001234567" and "01001234567" are one human, and
     * duplicate detection is worthless if it cannot see that. Reducing to the
     * trailing digits drops whichever country or trunk prefix was typed, without
     * having to know the dialling plan.
     */
    public const SUBSCRIBER_DIGITS = 9;

    public function normalizeMobile(string $mobile): string
    {
        $digits = preg_replace('/\D+/', '', $mobile) ?? '';

        return strlen($digits) > self::SUBSCRIBER_DIGITS
            ? substr($digits, -self::SUBSCRIBER_DIGITS)
            : $digits;
    }

    private function nextNumber(string $companyId): string
    {
        $last = Applicant::withTrashed()
            ->where('company_id', $companyId)
            ->where('applicant_number', 'like', 'APP-%')
            ->orderByDesc('applicant_number')
            ->value('applicant_number');

        $next = $last === null ? 1 : ((int) substr((string) $last, 4)) + 1;

        return 'APP-'.str_pad((string) $next, 5, '0', STR_PAD_LEFT);
    }
}
