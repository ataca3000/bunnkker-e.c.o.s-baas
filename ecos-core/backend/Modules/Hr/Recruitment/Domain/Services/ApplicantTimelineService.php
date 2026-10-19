<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Hr\Recruitment\Domain\Enums\TimelineEventType;
use Modules\Hr\Recruitment\Domain\Models\ApplicantTimelineEvent;
use Modules\Hr\Recruitment\Domain\Models\JobApplication;

/**
 * The candidate's story, written once and never rewritten.
 *
 * ┌─ NARRATION, NOT TRUTH ──────────────────────────────────────────────────┐
 * │ H5's stage events, evaluations and interviews remain the source of truth    │
 * │ for their own facts. This is the account of what happened, ordered, so a    │
 * │ recruiter opening a candidate sees the whole story instead of four tables.  │
 * │                                                                            │
 * │ Because it is narration, it is written by the services that DO the thing —  │
 * │ tagging writes the tag entry, the offer service writes the offer entries.   │
 * │ Nothing here polls or reconstructs, so an entry can only exist if the act   │
 * │ it describes actually happened.                                            │
 * │                                                                            │
 * │ APPEND-ONLY, enforced by the model. `record()` is the only way in, and      │
 * │ there is deliberately no update, no delete and no correct().                │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class ApplicantTimelineService
{
    /**
     * Write one entry.
     *
     * @param  array<string, mixed>  $data  title, summary, application, subject, context
     */
    public function record(
        string $companyId,
        string $applicantId,
        TimelineEventType $type,
        array $data = [],
        ?int $actorId = null,
    ): ApplicantTimelineEvent {
        return ApplicantTimelineEvent::create([
            'company_id' => $companyId,
            'applicant_id' => $applicantId,
            'application_id' => $data['application_id'] ?? null,
            'event_type' => $type->value,
            'title' => (string) ($data['title'] ?? $type->label()),
            'summary' => $data['summary'] ?? null,
            'category' => $type->category(),
            'subject_type' => $data['subject_type'] ?? null,
            'subject_id' => $data['subject_id'] ?? null,
            'context' => $data['context'] ?? null,
            'actor_id' => $actorId,
            'actor_name' => $data['actor_name'] ?? null,
            // Nobody was at the keyboard: the portal, an expiry sweep, a merge.
            'is_system' => $actorId === null,
            'occurred_at' => $data['occurred_at'] ?? Carbon::now(),
        ]);
    }

    /** Convenience for the common case: an entry about one candidacy. */
    public function recordForApplication(
        JobApplication $application,
        TimelineEventType $type,
        array $data = [],
        ?int $actorId = null,
    ): ApplicantTimelineEvent {
        return $this->record(
            (string) $application->company_id,
            (string) $application->applicant_id,
            $type,
            $data + ['application_id' => (string) $application->id],
            $actorId,
        );
    }

    /**
     * One candidate's timeline.
     *
     * @param  array<string, mixed>  $filters  category, event_type, application_id,
     *                                         from, to, milestones_only
     * @return array<int, array<string, mixed>>
     */
    public function forApplicant(string $companyId, string $applicantId, array $filters = []): array
    {
        $query = ApplicantTimelineEvent::query()
            ->where('company_id', $companyId)
            ->where('applicant_id', $applicantId);

        $this->applyFilters($query, $filters);

        $events = $query->chronological()->get();

        // Applied after the query: whether an event is a milestone is the enum's
        // judgement, not a column, so it cannot drift out of step with the vocabulary.
        if (($filters['milestones_only'] ?? false) === true) {
            $events = $events->filter(
                fn (ApplicantTimelineEvent $e) => $e->event_type->isMilestone()
            )->values();
        }

        return $events->map(fn (ApplicantTimelineEvent $e) => $this->present($e))->all();
    }

    /**
     * The timeline of one candidacy, plus the person-level entries that surround it
     * — a duplicate found at intake or a tag added later belongs to the person, but
     * it is still part of the story of this application.
     *
     * @return array<int, array<string, mixed>>
     */
    public function forApplication(JobApplication $application, array $filters = []): array
    {
        $query = ApplicantTimelineEvent::query()
            ->where('company_id', $application->company_id)
            ->where('applicant_id', $application->applicant_id)
            ->where(function ($q) use ($application): void {
                $q->where('application_id', $application->id)->orWhereNull('application_id');
            });

        $this->applyFilters($query, $filters);

        return $query->chronological()->get()
            ->map(fn (ApplicantTimelineEvent $e) => $this->present($e))->all();
    }

    /**
     * What the filter bar offers, counted for this candidate so empty chips can be
     * hidden rather than clicked into nothing.
     *
     * @return array<string, mixed>
     */
    public function filterOptions(string $companyId, string $applicantId): array
    {
        $events = ApplicantTimelineEvent::query()
            ->where('company_id', $companyId)
            ->where('applicant_id', $applicantId)
            ->get(['event_type', 'category']);

        return [
            'categories' => collect(TimelineEventType::categories())
                ->map(fn (string $c) => [
                    'key' => $c,
                    'count' => $events->where('category', $c)->count(),
                ])->values()->all(),
            'event_types' => $events->groupBy(fn ($e) => $e->event_type->value)
                ->map(fn ($group, $key) => [
                    'key' => $key,
                    'label' => TimelineEventType::from($key)->label(),
                    'count' => $group->count(),
                ])->values()->all(),
            'total' => $events->count(),
        ];
    }

    /** @param \Illuminate\Database\Eloquent\Builder<ApplicantTimelineEvent> $query */
    private function applyFilters($query, array $filters): void
    {
        if (! empty($filters['category'])) {
            $query->whereIn('category', (array) $filters['category']);
        }

        if (! empty($filters['event_type'])) {
            $query->whereIn('event_type', (array) $filters['event_type']);
        }

        if (! empty($filters['application_id'])) {
            $query->where('application_id', $filters['application_id']);
        }

        if (! empty($filters['from'])) {
            $query->where('occurred_at', '>=', Carbon::parse((string) $filters['from'])->startOfDay());
        }

        if (! empty($filters['to'])) {
            $query->where('occurred_at', '<=', Carbon::parse((string) $filters['to'])->endOfDay());
        }
    }

    /** @return array<string, mixed> */
    private function present(ApplicantTimelineEvent $event): array
    {
        return [
            'id' => (string) $event->id,
            'event_type' => $event->event_type->value,
            'event_label' => $event->event_type->label(),
            'category' => $event->category,
            'is_milestone' => $event->event_type->isMilestone(),
            'title' => $event->title,
            'summary' => $event->summary,
            'description' => $event->describe(),
            'application_id' => $event->application_id === null ? null : (string) $event->application_id,
            'subject_type' => $event->subject_type,
            'subject_id' => $event->subject_id,
            // The context is the explanation: which tag, which salary, which stage.
            'context' => $event->context ?? [],
            'actor_id' => $event->actor_id,
            'actor_name' => $event->actor_name,
            'is_system' => (bool) $event->is_system,
            'occurred_at' => $event->occurred_at?->toDateTimeString(),
        ];
    }
}
