<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Enums;

/**
 * Everything that can happen to a candidacy, in one vocabulary.
 *
 * The categories exist so the timeline can be filtered by the question being
 * asked — "just show me the decisions", "just the interviews" — without the UI
 * having to know which event types belong together.
 */
enum TimelineEventType: string
{
    case ApplicationSubmitted = 'application_submitted';
    case DuplicateDetected = 'duplicate_detected';
    case ApplicantMerged = 'applicant_merged';
    case InitialReview = 'initial_review';
    case RecruiterAssigned = 'recruiter_assigned';
    case StageChanged = 'stage_changed';
    case PhoneInterview = 'phone_interview';
    case InterviewScheduled = 'interview_scheduled';
    case InterviewCompleted = 'interview_completed';
    case EvaluationRecorded = 'evaluation_recorded';
    case TagAdded = 'tag_added';
    case TagRemoved = 'tag_removed';
    case OfferGenerated = 'offer_generated';
    case OfferRevised = 'offer_revised';
    case OfferSent = 'offer_sent';
    case OfferAccepted = 'offer_accepted';
    case OfferDeclined = 'offer_declined';
    case OfferExpired = 'offer_expired';
    case OfferWithdrawn = 'offer_withdrawn';
    case Hired = 'hired';
    case Rejected = 'rejected';
    case Archived = 'archived';
    case MovedToTalentPool = 'moved_to_talent_pool';
    case NoteAdded = 'note_added';

    /** Which filter chip this belongs under. */
    public function category(): string
    {
        return match ($this) {
            self::ApplicationSubmitted, self::InitialReview, self::StageChanged,
            self::RecruiterAssigned => 'pipeline',

            self::PhoneInterview, self::InterviewScheduled,
            self::InterviewCompleted => 'interview',

            self::EvaluationRecorded => 'evaluation',

            self::OfferGenerated, self::OfferRevised, self::OfferSent, self::OfferAccepted,
            self::OfferDeclined, self::OfferExpired, self::OfferWithdrawn => 'offer',

            self::Hired, self::Rejected, self::MovedToTalentPool => 'decision',

            self::TagAdded, self::TagRemoved => 'tag',

            self::DuplicateDetected, self::ApplicantMerged, self::Archived,
            self::NoteAdded => 'administrative',
        };
    }

    /**
     * Events that changed the outcome, as opposed to recording activity.
     *
     * A summary view shows these and hides the rest, which is the difference
     * between "what happened" and "what mattered".
     */
    public function isMilestone(): bool
    {
        return in_array($this, [
            self::ApplicationSubmitted, self::OfferSent, self::OfferAccepted,
            self::OfferDeclined, self::Hired, self::Rejected, self::MovedToTalentPool,
        ], true);
    }

    public function label(): string
    {
        return match ($this) {
            self::ApplicationSubmitted => 'Application Submitted',
            self::DuplicateDetected => 'Duplicate Detected',
            self::ApplicantMerged => 'Applicant Merged',
            self::InitialReview => 'Initial Review',
            self::RecruiterAssigned => 'Recruiter Assigned',
            self::StageChanged => 'Stage Changed',
            self::PhoneInterview => 'Phone Interview',
            self::InterviewScheduled => 'Interview Scheduled',
            self::InterviewCompleted => 'Interview Completed',
            self::EvaluationRecorded => 'Evaluation Recorded',
            self::TagAdded => 'Tag Added',
            self::TagRemoved => 'Tag Removed',
            self::OfferGenerated => 'Offer Generated',
            self::OfferRevised => 'Offer Revised',
            self::OfferSent => 'Offer Sent',
            self::OfferAccepted => 'Offer Accepted',
            self::OfferDeclined => 'Offer Declined',
            self::OfferExpired => 'Offer Expired',
            self::OfferWithdrawn => 'Offer Withdrawn',
            self::Hired => 'Hired',
            self::Rejected => 'Rejected',
            self::Archived => 'Archived',
            self::MovedToTalentPool => 'Moved To Talent Pool',
            self::NoteAdded => 'Note Added',
        };
    }

    /** @return array<int, string> */
    public static function categories(): array
    {
        return array_values(array_unique(array_map(
            static fn (self $c) => $c->category(),
            self::cases(),
        )));
    }
}
