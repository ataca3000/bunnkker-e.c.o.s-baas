<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Hr\Recruitment\Domain\Enums\ApplicationStatus;
use Modules\Hr\Recruitment\Domain\Enums\OfferStatus;
use Modules\Hr\Recruitment\Domain\Enums\TimelineEventType;
use Modules\Hr\Recruitment\Domain\Exceptions\RecruitmentException;
use Modules\Hr\Recruitment\Domain\Models\JobApplication;
use Modules\Hr\Recruitment\Domain\Models\Offer;
use Modules\Hr\Recruitment\Domain\Models\OfferVersion;
use Modules\Hr\Workforce\Domain\Models\Department;
use Modules\Hr\Workforce\Domain\Models\EmploymentType;
use Modules\Hr\Workforce\Domain\Models\Position;

/**
 * Offer letters.
 *
 * ┌─ REVISING IS APPENDING ─────────────────────────────────────────────────┐
 * │ A salary that was negotiated up did not "become" the new number — it was    │
 * │ one number and then another, and the company may have to prove both. So a   │
 * │ revision writes a NEW version and leaves the previous one untouched, which  │
 * │ is why the version model refuses updates outright.                          │
 * │                                                                            │
 * │ The version also stores the department and position NAMES beside their ids. │
 * │ Renaming a department next year must not retroactively change what a        │
 * │ candidate was told, and an id alone cannot prevent that.                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE SALARY HERE IS NOT PAY ────────────────────────────────────────────┐
 * │ Nothing in Payroll reads this table. The figure becomes compensation only   │
 * │ when hiring hands it to SalaryStructureService, which owns what people are  │
 * │ actually paid. An offer is a proposal until someone is employed.            │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class OfferService
{
    public function __construct(private readonly ApplicantTimelineService $timeline) {}

    // ── Drafting ──────────────────────────────────────────────────────────────

    /**
     * Draft an offer against an accepted candidacy.
     *
     * @param  array<string, mixed>  $terms
     */
    public function draft(JobApplication $application, array $terms, ?int $actorId = null): Offer
    {
        $this->assertNoOpenOffer($application);

        $applicant = $application->applicant;

        if ($applicant === null) {
            throw RecruitmentException::notReadyToHire('unknown');
        }

        return DB::transaction(function () use ($application, $applicant, $terms, $actorId): Offer {
            $offer = Offer::create([
                'company_id' => $application->company_id,
                'application_id' => $application->id,
                'applicant_id' => $applicant->id,
                'offer_number' => $this->nextOfferNumber((string) $application->company_id),
                'status' => OfferStatus::Draft->value,
                'current_version' => 1,
                'expires_on' => $terms['expires_on'] ?? null,
                'created_by' => $actorId,
            ]);

            $version = $this->writeVersion($offer, $application, $terms, 1, null, $actorId);

            $this->timeline->recordForApplication($application, TimelineEventType::OfferGenerated, [
                'title' => 'Offer '.$offer->offer_number.' generated',
                'summary' => $this->money($version),
                'subject_type' => 'offer',
                'subject_id' => (string) $offer->id,
                'context' => ['offer_number' => $offer->offer_number, 'version' => 1] + $version->terms(),
            ], $actorId);

            return $offer->refresh();
        });
    }

    /**
     * Revise an offer. Produces a new version; the previous one stays as it was.
     *
     * @param  array<string, mixed>  $terms
     */
    public function revise(Offer $offer, array $terms, string $reason, ?int $actorId = null): Offer
    {
        if ($offer->status->isFinal()) {
            throw RecruitmentException::offerNotRevisable($offer->status->value);
        }

        $application = $offer->application;

        if ($application === null) {
            throw RecruitmentException::offerNotRevisable('detached');
        }

        return DB::transaction(function () use ($offer, $application, $terms, $reason, $actorId): Offer {
            $previous = $offer->currentTerms();
            $next = (int) $offer->current_version + 1;

            // Unspecified fields carry forward from the version in play, so a
            // revision that only moves the salary does not blank the start date.
            $version = $this->writeVersion($offer, $application, $terms, $next, $previous, $actorId, $reason);

            $offer->update(['current_version' => $next]);

            $this->timeline->recordForApplication($application, TimelineEventType::OfferRevised, [
                'title' => 'Offer '.$offer->offer_number.' revised to version '.$next,
                'summary' => $reason,
                'subject_type' => 'offer',
                'subject_id' => (string) $offer->id,
                'context' => [
                    'offer_number' => $offer->offer_number,
                    'version' => $next,
                    'reason' => $reason,
                    // What actually moved — the whole reason a revision is worth logging.
                    'changes' => $version->changesAgainst($previous),
                ],
            ], $actorId);

            return $offer->refresh();
        });
    }

    // ── The workflow ──────────────────────────────────────────────────────────

    public function send(Offer $offer, ?int $actorId = null): Offer
    {
        $this->assertTransition($offer, OfferStatus::Sent);

        return DB::transaction(function () use ($offer, $actorId): Offer {
            $offer->update([
                'status' => OfferStatus::Sent->value,
                'sent_at' => Carbon::now(),
                'sent_by' => $actorId,
            ]);

            // The candidacy moves with the offer — a candidate who has an offer in
            // hand is not merely "accepted" any more.
            $this->moveApplication($offer, ApplicationStatus::OfferSent, $actorId);

            $this->recordOfferEvent($offer, TimelineEventType::OfferSent,
                'Offer '.$offer->offer_number.' sent',
                $offer->expires_on === null ? null : 'Expires '.$offer->expires_on->toDateString(),
                $actorId);

            return $offer->refresh();
        });
    }

    public function accept(Offer $offer, ?string $note = null, ?int $actorId = null): Offer
    {
        // An offer that lapsed is not accepted by someone answering late. The date
        // was the company's commitment and it has run out.
        if ($offer->hasLapsed()) {
            $this->expire($offer);

            throw RecruitmentException::offerExpired();
        }

        $this->assertTransition($offer, OfferStatus::Accepted);

        return DB::transaction(function () use ($offer, $note, $actorId): Offer {
            $offer->update([
                'status' => OfferStatus::Accepted->value,
                'responded_at' => Carbon::now(),
                'response_note' => $note,
            ]);

            $this->moveApplication($offer, ApplicationStatus::OfferAccepted, $actorId);

            $this->recordOfferEvent($offer, TimelineEventType::OfferAccepted,
                'Offer '.$offer->offer_number.' accepted', $note, $actorId);

            return $offer->refresh();
        });
    }

    public function decline(Offer $offer, ?string $note = null, ?int $actorId = null): Offer
    {
        $this->assertTransition($offer, OfferStatus::Declined);

        return DB::transaction(function () use ($offer, $note, $actorId): Offer {
            $offer->update([
                'status' => OfferStatus::Declined->value,
                'responded_at' => Carbon::now(),
                'response_note' => $note,
            ]);

            $this->moveApplication($offer, ApplicationStatus::OfferDeclined, $actorId);

            $this->recordOfferEvent($offer, TimelineEventType::OfferDeclined,
                'Offer '.$offer->offer_number.' declined', $note, $actorId);

            return $offer->refresh();
        });
    }

    /** The company changing its mind, as distinct from the candidate declining. */
    public function withdraw(Offer $offer, string $reason, ?int $actorId = null): Offer
    {
        $this->assertTransition($offer, OfferStatus::Withdrawn);

        return DB::transaction(function () use ($offer, $reason, $actorId): Offer {
            $offer->update([
                'status' => OfferStatus::Withdrawn->value,
                'withdrawn_at' => Carbon::now(),
                'response_note' => $reason,
            ]);

            $this->recordOfferEvent($offer, TimelineEventType::OfferWithdrawn,
                'Offer '.$offer->offer_number.' withdrawn', $reason, $actorId);

            return $offer->refresh();
        });
    }

    /** One offer past its date. Nobody's decision, so no actor. */
    public function expire(Offer $offer): Offer
    {
        if (! $offer->status->canTransitionTo(OfferStatus::Expired)) {
            return $offer;
        }

        $offer->update(['status' => OfferStatus::Expired->value]);

        $this->recordOfferEvent($offer, TimelineEventType::OfferExpired,
            'Offer '.$offer->offer_number.' expired',
            'Passed its expiry date of '.$offer->expires_on?->toDateString().' without an answer',
            null);

        return $offer->refresh();
    }

    /**
     * Expire everything that has lapsed. Idempotent — safe to run repeatedly.
     *
     * @return array<string, mixed>
     */
    public function expireLapsed(string $companyId): array
    {
        $lapsed = Offer::query()->where('company_id', $companyId)->lapsed()->get();

        foreach ($lapsed as $offer) {
            $this->expire($offer);
        }

        return [
            'expired' => $lapsed->count(),
            'offer_numbers' => $lapsed->pluck('offer_number')->all(),
        ];
    }

    // ── Reading ───────────────────────────────────────────────────────────────

    /**
     * The accepted offer standing behind a candidacy, if there is one.
     *
     * This is the single question hiring asks, and the only place it is answered.
     */
    public function acceptedOfferFor(JobApplication $application): ?Offer
    {
        return Offer::query()
            ->where('application_id', $application->id)
            ->where('status', OfferStatus::Accepted->value)
            ->latest('responded_at')
            ->first();
    }

    /**
     * An offer with its full version history — what was offered, and what changed.
     *
     * @return array<string, mixed>
     */
    public function detail(Offer $offer): array
    {
        $versions = $offer->versions()->get();
        $current = $offer->currentTerms();

        $history = [];
        $previous = null;

        foreach ($versions as $version) {
            $history[] = [
                'id' => (string) $version->id,
                'version' => (int) $version->version,
                'is_current' => (int) $version->version === (int) $offer->current_version,
                'terms' => $version->terms(),
                'revision_reason' => $version->revision_reason,
                'changes' => $version->changesAgainst($previous),
                'created_by' => $version->created_by,
                'created_at' => $version->created_at?->toDateTimeString(),
            ];
            $previous = $version;
        }

        return [
            'id' => (string) $offer->id,
            'offer_number' => $offer->offer_number,
            'status' => $offer->status->value,
            'status_label' => $offer->status->label(),
            'application_id' => (string) $offer->application_id,
            'applicant_id' => (string) $offer->applicant_id,
            'current_version' => (int) $offer->current_version,
            'terms' => $current?->terms(),
            'expires_on' => $offer->expires_on?->toDateString(),
            'has_lapsed' => $offer->hasLapsed(),
            'days_until_expiry' => $this->daysUntilExpiry($offer),
            'sent_at' => $offer->sent_at?->toDateTimeString(),
            'responded_at' => $offer->responded_at?->toDateTimeString(),
            'response_note' => $offer->response_note,
            'withdrawn_at' => $offer->withdrawn_at?->toDateTimeString(),
            'permits_hiring' => $offer->permitsHiring(),
            'version_history' => $history,
        ];
    }

    /**
     * The offer letter as a printable document.
     *
     * Returned as structured content rather than a binary. No PDF library is
     * installed and adding one for this would be a dependency the whole
     * application carries; the presentation layer renders this to a print-ready
     * page, and a browser's own "save as PDF" produces the file. What matters is
     * that the CONTENT comes from the frozen version, so a printed letter and the
     * record always say the same thing.
     *
     * @return array<string, mixed>
     */
    public function document(Offer $offer): array
    {
        $version = $offer->currentTerms();

        if ($version === null) {
            throw RecruitmentException::offerNotRevisable('empty');
        }

        return [
            'offer_number' => $offer->offer_number,
            'version' => (int) $version->version,
            'status' => $offer->status->value,
            'issued_on' => $offer->sent_at?->toDateString() ?? $offer->created_at?->toDateString(),
            'expires_on' => $offer->expires_on?->toDateString(),
            'terms' => $version->terms(),
            // Spelled out so the letter never renders a bare number with no currency.
            'salary_line' => number_format((float) $version->basic_salary, 2).' '.$version->currency.' per month',
            'notes' => $version->notes,
        ];
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /**
     * @param  array<string, mixed>  $terms
     */
    private function writeVersion(
        Offer $offer,
        JobApplication $application,
        array $terms,
        int $version,
        ?OfferVersion $previous,
        ?int $actorId,
        ?string $reason = null,
    ): OfferVersion {
        $opening = $application->jobOpening;
        $applicant = $application->applicant;

        // Precedence: what was asked for, then what the previous version said, then
        // what the job opening advertised.
        $pick = fn (string $key, mixed $fallback = null) => $terms[$key]
            ?? ($previous?->{$key})
            ?? $fallback;

        $positionId = $pick('position_id', $opening?->position_id);
        $departmentId = $pick('department_id', $opening?->department_id);
        $employmentTypeId = $pick('employment_type_id', $opening?->employment_type_id);
        $branchId = $pick('branch_id', $opening?->branch_id);

        return OfferVersion::create([
            'company_id' => $offer->company_id,
            'offer_id' => $offer->id,
            'version' => $version,
            'candidate_name' => (string) $pick('candidate_name', $applicant?->full_name ?? 'Unknown'),
            'position_id' => $positionId,
            'department_id' => $departmentId,
            'employment_type_id' => $employmentTypeId,
            'branch_id' => $branchId,
            // Frozen names — what the letter says, not what the row says today.
            'position_title' => $this->nameOf(Position::class, $positionId) ?? $opening?->title,
            'department_name' => $this->nameOf(Department::class, $departmentId),
            'branch_name' => $this->branchName($branchId),
            'employment_type_name' => $this->nameOf(EmploymentType::class, $employmentTypeId),
            'start_date' => $pick('start_date', $application->available_from?->toDateString()),
            'basic_salary' => round((float) $pick('basic_salary', 0), 2),
            'currency' => (string) $pick('currency', $application->currency ?? 'EGP'),
            'notes' => $pick('notes'),
            'revision_reason' => $reason,
            'created_by' => $actorId,
        ]);
    }

    private function nameOf(string $modelClass, mixed $id): ?string
    {
        if ($id === null) {
            return null;
        }

        $record = $modelClass::query()->find($id);

        return $record === null ? null : (string) ($record->name ?? $record->title ?? '');
    }

    /**
     * Branches belong to Organization, not HR. Read by id through the query
     * builder — HR names the table it needs rather than importing another
     * module's model.
     */
    private function branchName(mixed $branchId): ?string
    {
        if ($branchId === null) {
            return null;
        }

        $name = DB::table('branches')->where('id', $branchId)->value('name');

        return $name === null ? null : (string) $name;
    }

    private function assertNoOpenOffer(JobApplication $application): void
    {
        $open = Offer::query()
            ->where('application_id', $application->id)
            ->open()
            ->first();

        if ($open !== null) {
            throw RecruitmentException::offerAlreadyOpen((string) $open->offer_number);
        }
    }

    private function assertTransition(Offer $offer, OfferStatus $target): void
    {
        if (! $offer->status->canTransitionTo($target)) {
            throw RecruitmentException::invalidOfferTransition($offer->status->value, $target->value);
        }
    }

    /**
     * Move the candidacy alongside the offer, but only where the status machine
     * allows it. The offer never forces an invalid application state.
     */
    private function moveApplication(Offer $offer, ApplicationStatus $target, ?int $actorId): void
    {
        $application = $offer->application;

        if ($application === null || ! $application->status->canTransitionTo($target)) {
            return;
        }

        $application->update([
            'status' => $target->value,
            'decided_at' => $target->isClosed() ? Carbon::now() : $application->decided_at,
            'decided_by' => $target->isClosed() ? $actorId : $application->decided_by,
        ]);
    }

    private function recordOfferEvent(Offer $offer, TimelineEventType $type, string $title, ?string $summary, ?int $actorId): void
    {
        $application = $offer->application;

        if ($application === null) {
            return;
        }

        $this->timeline->recordForApplication($application, $type, [
            'title' => $title,
            'summary' => $summary,
            'subject_type' => 'offer',
            'subject_id' => (string) $offer->id,
            'context' => [
                'offer_number' => $offer->offer_number,
                'version' => (int) $offer->current_version,
                'status' => $offer->status->value,
            ],
        ], $actorId);
    }

    private function daysUntilExpiry(Offer $offer): ?int
    {
        if ($offer->expires_on === null || ! $offer->status->isOpen()) {
            return null;
        }

        return (int) Carbon::now()->startOfDay()->diffInDays($offer->expires_on->startOfDay(), false);
    }

    private function money(OfferVersion $version): string
    {
        return number_format((float) $version->basic_salary, 2).' '.$version->currency;
    }

    private function nextOfferNumber(string $companyId): string
    {
        $last = Offer::query()
            ->where('company_id', $companyId)
            ->where('offer_number', 'like', 'OFF-%')
            ->orderByDesc('offer_number')
            ->value('offer_number');

        $next = $last === null ? 1 : ((int) substr((string) $last, 4)) + 1;

        return 'OFF-'.str_pad((string) $next, 5, '0', STR_PAD_LEFT);
    }
}
