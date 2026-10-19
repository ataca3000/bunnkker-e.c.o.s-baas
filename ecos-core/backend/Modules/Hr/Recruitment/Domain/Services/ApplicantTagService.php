<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Hr\Recruitment\Domain\Enums\TimelineEventType;
use Modules\Hr\Recruitment\Domain\Exceptions\RecruitmentException;
use Modules\Hr\Recruitment\Domain\Models\Applicant;
use Modules\Hr\Recruitment\Domain\Models\ApplicantTag;
use Modules\Hr\Recruitment\Domain\Models\ApplicantTagAssignment;

/**
 * Tagging candidates.
 *
 * ┌─ THE CATALOGUE IS THE POINT ────────────────────────────────────────────┐
 * │ A tag is only useful if two recruiters mean the same thing by it, which is  │
 * │ why tags are company rows rather than words typed on an applicant. That is  │
 * │ also what makes them searchable: "every VIP candidate" is a join, not a     │
 * │ LIKE across a text column that will miss "V.I.P." and "vip ".               │
 * │                                                                            │
 * │ Every add and every remove writes to the timeline. A tag that appears and   │
 * │ disappears with nobody's name against it is how "who marked this candidate  │
 * │ urgent" becomes unanswerable — and tagging is exactly the kind of soft      │
 * │ signal that later gets questioned.                                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class ApplicantTagService
{
    public function __construct(private readonly ApplicantTimelineService $timeline) {}

    // ── The catalogue ─────────────────────────────────────────────────────────

    public function createTag(string $companyId, array $data, ?int $actorId = null): ApplicantTag
    {
        return ApplicantTag::create([
            'company_id' => $companyId,
            'key' => (string) ($data['key'] ?? Str::slug((string) $data['name'], '_')),
            'name' => (string) $data['name'],
            'description' => $data['description'] ?? null,
            'color' => (string) ($data['color'] ?? 'slate'),
            'is_active' => $data['is_active'] ?? true,
            'sequence' => (int) ($data['sequence'] ?? 100),
            'created_by' => $actorId,
        ]);
    }

    public function updateTag(ApplicantTag $tag, array $data): ApplicantTag
    {
        // The key is the tag's identity — filters, saved searches and every
        // assignment already made point at it. Renaming the label is free; renaming
        // the key would silently orphan all of that.
        $tag->update(array_intersect_key($data, array_flip([
            'name', 'description', 'color', 'is_active', 'sequence',
        ])));

        return $tag->refresh();
    }

    /**
     * Delete a tag nobody carries; deactivate one that is in use.
     *
     * Deleting an assigned tag would cascade the assignments away and take the
     * history with it.
     */
    public function deleteTag(ApplicantTag $tag): void
    {
        if ($tag->isInUse()) {
            throw RecruitmentException::tagInUse((string) $tag->name);
        }

        $tag->delete();
    }

    /**
     * The catalogue, with how many applicants carry each tag.
     *
     * @return array<int, array<string, mixed>>
     */
    public function catalogue(string $companyId, bool $activeOnly = false): array
    {
        $query = ApplicantTag::query()
            ->where('company_id', $companyId)
            ->withCount('assignments')
            ->orderBy('sequence')
            ->orderBy('name');

        if ($activeOnly) {
            $query->active();
        }

        return $query->get()->map(fn (ApplicantTag $tag) => [
            'id' => (string) $tag->id,
            'key' => $tag->key,
            'name' => $tag->name,
            'description' => $tag->description,
            'color' => $tag->color,
            'is_active' => (bool) $tag->is_active,
            'sequence' => (int) $tag->sequence,
            'applicant_count' => (int) $tag->assignments_count,
        ])->all();
    }

    // ── Assigning ─────────────────────────────────────────────────────────────

    /** Add a tag to an applicant. Adding one they already carry changes nothing. */
    public function assign(Applicant $applicant, ApplicantTag $tag, ?string $note = null, ?int $actorId = null): ApplicantTagAssignment
    {
        $this->assertSameCompany($applicant, $tag);

        $existing = ApplicantTagAssignment::query()
            ->where('applicant_id', $applicant->id)
            ->where('tag_id', $tag->id)
            ->first();

        if ($existing !== null) {
            return $existing;
        }

        $assignment = ApplicantTagAssignment::create([
            'company_id' => $applicant->company_id,
            'applicant_id' => $applicant->id,
            'tag_id' => $tag->id,
            'note' => $note,
            'assigned_by' => $actorId,
            'assigned_at' => Carbon::now(),
        ]);

        $this->timeline->record(
            (string) $applicant->company_id,
            (string) $applicant->id,
            TimelineEventType::TagAdded,
            [
                'title' => 'Tagged "'.$tag->name.'"',
                'summary' => $note,
                'subject_type' => 'applicant_tag',
                'subject_id' => (string) $tag->id,
                'context' => ['tag_key' => $tag->key, 'tag_name' => $tag->name, 'color' => $tag->color],
            ],
            $actorId,
        );

        return $assignment;
    }

    /** Remove a tag. Removing one they never carried changes nothing. */
    public function remove(Applicant $applicant, ApplicantTag $tag, ?int $actorId = null): void
    {
        $assignment = ApplicantTagAssignment::query()
            ->where('applicant_id', $applicant->id)
            ->where('tag_id', $tag->id)
            ->first();

        if ($assignment === null) {
            return;
        }

        $assignment->delete();

        // The assignment row is gone; the fact that it was there, and who removed
        // it, stays on the timeline.
        $this->timeline->record(
            (string) $applicant->company_id,
            (string) $applicant->id,
            TimelineEventType::TagRemoved,
            [
                'title' => 'Removed tag "'.$tag->name.'"',
                'subject_type' => 'applicant_tag',
                'subject_id' => (string) $tag->id,
                'context' => ['tag_key' => $tag->key, 'tag_name' => $tag->name],
            ],
            $actorId,
        );
    }

    /**
     * Set an applicant's tags to exactly this list, adding and removing as needed.
     *
     * @param  array<int, string>  $tagIds
     * @return array<string, mixed>
     */
    public function sync(Applicant $applicant, array $tagIds, ?int $actorId = null): array
    {
        $wanted = ApplicantTag::query()
            ->where('company_id', $applicant->company_id)
            ->whereIn('id', $tagIds)
            ->get();

        // Ids that are not this company's tags are refused rather than ignored —
        // silently dropping them would leave the caller thinking they applied.
        if ($wanted->count() !== count(array_unique($tagIds))) {
            throw RecruitmentException::tagNotInCatalogue();
        }

        $current = ApplicantTagAssignment::query()
            ->where('applicant_id', $applicant->id)->get()->keyBy('tag_id');

        $added = [];
        $removed = [];

        DB::transaction(function () use ($applicant, $wanted, $current, $actorId, &$added, &$removed): void {
            foreach ($wanted as $tag) {
                if (! $current->has($tag->id)) {
                    $this->assign($applicant, $tag, null, $actorId);
                    $added[] = $tag->key;
                }
            }

            $keep = $wanted->pluck('id')->all();

            foreach ($current as $tagId => $assignment) {
                if (in_array($tagId, $keep, false)) {
                    continue;
                }

                $tag = ApplicantTag::find($tagId);

                if ($tag !== null) {
                    $this->remove($applicant, $tag, $actorId);
                    $removed[] = $tag->key;
                }
            }
        });

        return ['added' => $added, 'removed' => $removed];
    }

    /**
     * The tags one applicant carries.
     *
     * @return array<int, array<string, mixed>>
     */
    public function tagsFor(string $applicantId): array
    {
        return ApplicantTagAssignment::query()
            ->with('tag')
            ->where('applicant_id', $applicantId)
            ->get()
            ->filter(fn (ApplicantTagAssignment $a) => $a->tag !== null)
            ->map(fn (ApplicantTagAssignment $a) => [
                'id' => (string) $a->tag->id,
                'key' => $a->tag->key,
                'name' => $a->tag->name,
                'color' => $a->tag->color,
                'note' => $a->note,
                'assigned_by' => $a->assigned_by,
                'assigned_at' => $a->assigned_at?->toDateTimeString(),
            ])->values()->all();
    }

    /**
     * Tags for many applicants at once, keyed by applicant id.
     *
     * A list of eighty candidates would otherwise fire eighty queries to render
     * eighty rows of chips.
     *
     * @param  array<int, string>  $applicantIds
     * @return array<string, array<int, array<string, mixed>>>
     */
    public function tagsForMany(array $applicantIds): array
    {
        if ($applicantIds === []) {
            return [];
        }

        return ApplicantTagAssignment::query()
            ->with('tag')
            ->whereIn('applicant_id', $applicantIds)
            ->get()
            ->filter(fn (ApplicantTagAssignment $a) => $a->tag !== null)
            ->groupBy(fn (ApplicantTagAssignment $a) => (string) $a->applicant_id)
            ->map(fn ($group) => $group->map(fn (ApplicantTagAssignment $a) => [
                'id' => (string) $a->tag->id,
                'key' => $a->tag->key,
                'name' => $a->tag->name,
                'color' => $a->tag->color,
            ])->values()->all())
            ->all();
    }

    /**
     * The applicant ids carrying these tags — the filter behind "show me every VIP".
     *
     * `matchAll` decides whether the tags are an OR or an AND: "urgent OR referred"
     * widens the list, "urgent AND referred" narrows it, and both are asked for.
     *
     * @param  array<int, string>  $tagKeys
     * @return array<int, string>
     */
    public function applicantIdsWithTags(string $companyId, array $tagKeys, bool $matchAll = false): array
    {
        if ($tagKeys === []) {
            return [];
        }

        $tagIds = ApplicantTag::query()
            ->where('company_id', $companyId)
            ->whereIn('key', $tagKeys)
            ->pluck('id')->all();

        if ($tagIds === []) {
            return [];
        }

        $query = ApplicantTagAssignment::query()
            ->where('company_id', $companyId)
            ->whereIn('tag_id', $tagIds)
            ->groupBy('applicant_id');

        if ($matchAll) {
            $query->havingRaw('COUNT(DISTINCT tag_id) = ?', [count($tagIds)]);
        }

        return $query->pluck('applicant_id')->map(fn ($id) => (string) $id)->all();
    }

    private function assertSameCompany(Applicant $applicant, ApplicantTag $tag): void
    {
        if ((string) $applicant->company_id !== (string) $tag->company_id) {
            throw RecruitmentException::tagNotInCatalogue();
        }
    }
}
