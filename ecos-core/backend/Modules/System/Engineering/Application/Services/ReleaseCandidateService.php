<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Modules\System\Engineering\Domain\Enums\ReleaseCandidateStatus;
use Modules\System\Engineering\Domain\Events\Inbox\ReleaseCandidateCreated;
use Modules\System\Engineering\Domain\Models\EngineeringReleaseCandidate;

final class ReleaseCandidateService
{
    /**
     * Allowed status transitions:
     *   draft        → under_review
     *   under_review → approved | rejected
     *   approved     → staged
     *   staged       → released | rolled_back
     */
    private const TRANSITIONS = [
        'draft'        => ['under_review'],
        'under_review' => ['approved', 'rejected'],
        'approved'     => ['staged'],
        'staged'       => ['released', 'rolled_back'],
    ];

    /**
     * Paginate release candidates for a company, optionally filtered by status.
     * Each row includes a `task_count` via a sub-query so we avoid N+1.
     */
    public function list(
        string $companyId,
        array  $filters = [],
        int    $page    = 1,
        int    $perPage = 15,
    ): LengthAwarePaginator {
        $query = EngineeringReleaseCandidate::query()
            ->where('company_id', $companyId)
            ->withCount('tasks')
            ->orderByDesc('created_at');

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        return $query->paginate(perPage: $perPage, page: $page);
    }

    /**
     * Create a new release candidate, attach tasks, and fire the domain event.
     *
     * @param array{title: string, description?: string|null, task_ids?: string[]} $data
     */
    public function create(string $companyId, array $data): EngineeringReleaseCandidate
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();

        return DB::transaction(function () use ($companyId, $data, $user): EngineeringReleaseCandidate {
            /** @var EngineeringReleaseCandidate $rc */
            $rc = EngineeringReleaseCandidate::create([
                'company_id'    => $companyId,
                'title'         => $data['title'],
                'description'   => $data['description'] ?? null,
                'status'        => ReleaseCandidateStatus::Draft,
                'created_by_id' => $user?->id,
                'version'       => 1,
            ]);

            $taskIds = $data['task_ids'] ?? [];

            if (! empty($taskIds)) {
                $pivot = [];
                foreach (array_values($taskIds) as $position => $taskId) {
                    $pivot[$taskId] = [
                        'position'   => $position,
                        'added_by_id' => $user?->id,
                    ];
                }
                $rc->tasks()->sync($pivot);
            }

            event(new ReleaseCandidateCreated(
                releaseCandidateId: $rc->id,
                companyId:          $companyId,
                title:              $rc->title,
                taskCount:          count($taskIds),
                createdById:        $user?->id ?? '',
            ));

            return $rc->load('tasks:id,title,status,priority');
        });
    }

    /**
     * Attach a task to the release candidate at the next available position.
     *
     * @throws \RuntimeException When the RC is in a terminal status.
     */
    public function addTask(EngineeringReleaseCandidate $rc, string $taskId): void
    {
        if ($rc->status->isTerminal()) {
            throw new \RuntimeException(
                "Cannot add tasks to a release candidate in '{$rc->status->value}' status.",
            );
        }

        /** @var \App\Models\User $user */
        $user = Auth::user();

        $nextPosition = $rc->tasks()->max('engineering_release_candidate_tasks.position') + 1;

        $rc->tasks()->attach($taskId, [
            'position'    => $nextPosition,
            'added_by_id' => $user?->id,
        ]);
    }

    /**
     * Detach a task from the release candidate.
     */
    public function removeTask(EngineeringReleaseCandidate $rc, string $taskId): void
    {
        $rc->tasks()->detach($taskId);
    }

    /**
     * Transition a release candidate to a new status.
     *
     * @throws \InvalidArgumentException When the transition is not permitted.
     */
    public function transition(
        EngineeringReleaseCandidate $rc,
        ReleaseCandidateStatus      $newStatus,
        ?string                     $reason = null,
    ): EngineeringReleaseCandidate {
        $currentValue = $rc->status->value;
        $newValue     = $newStatus->value;

        $allowed = self::TRANSITIONS[$currentValue] ?? [];

        if (! in_array($newValue, $allowed, true)) {
            throw new \InvalidArgumentException(
                "Transition from '{$currentValue}' to '{$newValue}' is not allowed.",
            );
        }

        /** @var \App\Models\User $user */
        $user = Auth::user();

        $attributes = ['status' => $newStatus->value];

        // Record reviewer on review-related transitions
        if (in_array($newValue, ['approved', 'rejected', 'under_review'], true)) {
            $attributes['reviewed_by_id'] = $user?->id;
        }

        // Timestamp + reason per transition
        match ($newValue) {
            'under_review' => $attributes['review_started_at'] = now(),
            'approved'     => $attributes['approved_at']       = now(),
            'rejected'     => array_merge($attributes, [
                'rejected_at'      => now(),
                'rejection_reason' => $reason,
            ]),
            'staged'       => $attributes['staged_at']         = now(),
            'released'     => $attributes['released_at']       = now(),
            'rolled_back'  => $attributes['rolled_back_at']    = now(),
            default        => null,
        };

        // Rejection reason is set separately because match() cannot use array_merge inline
        if ($newValue === 'rejected' && $reason !== null) {
            $attributes['rejection_reason'] = $reason;
            $attributes['rejected_at']      = now();
        }

        $rc->update($attributes);

        return $rc->refresh();
    }

    /**
     * Find a release candidate by ID with its tasks (id, title, status, priority).
     *
     * @throws \Illuminate\Database\Eloquent\ModelNotFoundException
     */
    public function get(string $id): EngineeringReleaseCandidate
    {
        return EngineeringReleaseCandidate::with('tasks:id,title,status,priority')
            ->findOrFail($id);
    }
}
