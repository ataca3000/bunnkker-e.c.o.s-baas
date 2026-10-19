<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Application\Services;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\System\Engineering\Domain\Enums\ReleaseStatus;
use Modules\System\Engineering\Domain\Enums\RiskLevel;
use Modules\System\Engineering\Domain\Models\EngineeringRelease;
use Modules\System\Engineering\Domain\Models\EngineeringTask;

final class ReleaseService
{
    public function __construct(
        private readonly ReleaseAuditService $audit,
    ) {}

    public function list(string $companyId, array $filters = [], int $page = 1, int $perPage = 25): LengthAwarePaginator
    {
        $q = EngineeringRelease::where('company_id', $companyId);
        if (!empty($filters['status'])) {
            $q->whereIn('status', (array) $filters['status']);
        }
        if (!empty($filters['risk_level'])) {
            $q->where('risk_level', $filters['risk_level']);
        }
        if (!empty($filters['search'])) {
            $q->where(fn($sq) => $sq->where('name', 'like', '%' . $filters['search'] . '%')
                ->orWhere('version', 'like', '%' . $filters['search'] . '%'));
        }
        return $q->orderByDesc('created_at')->paginate($perPage, ['*'], 'page', $page);
    }

    public function create(string $companyId, array $data, ?string $actorId = null): EngineeringRelease
    {
        return DB::transaction(function () use ($companyId, $data, $actorId) {
            $release = EngineeringRelease::create(array_merge($data, [
                'company_id'  => $companyId,
                'status'      => ReleaseStatus::Draft->value,
                'created_by'  => $actorId,
                'task_ids'    => $data['task_ids'] ?? [],
                'task_count'  => count($data['task_ids'] ?? []),
            ]));
            $this->audit->record($release, 'release_created', $actorId, null, ReleaseStatus::Draft->value, "Release [{$release->name}] created");
            return $release;
        });
    }

    public function update(EngineeringRelease $release, array $data, ?string $actorId = null): EngineeringRelease
    {
        $release->update($data);
        if (isset($data['task_ids'])) {
            $release->update(['task_count' => count($data['task_ids'])]);
        }
        $this->audit->record($release, 'release_updated', $actorId, null, null, 'Release details updated');
        return $release->fresh();
    }

    public function transition(EngineeringRelease $release, ReleaseStatus $next, ?string $actorId = null, string $reason = ''): EngineeringRelease
    {
        if (!$release->canTransitionTo($next)) {
            throw new \RuntimeException("Cannot transition release from [{$release->status->value}] to [{$next->value}]");
        }
        $from = $release->status->value;
        $timestamps = [
            ReleaseStatus::Collecting     => 'collected_at',
            ReleaseStatus::Validating     => null,
            ReleaseStatus::Ready          => 'validated_at',
            ReleaseStatus::Approved       => 'approved_at',
            ReleaseStatus::Rejected       => 'rejected_at',
            ReleaseStatus::PipelineRunning => 'pipeline_started_at',
            ReleaseStatus::Released       => 'released_at',
            ReleaseStatus::Cancelled      => 'cancelled_at',
            ReleaseStatus::Archived       => 'archived_at',
        ];
        $update = ['status' => $next->value];
        if (isset($timestamps[$next]) && $timestamps[$next]) {
            $update[$timestamps[$next]] = now();
        }
        if ($next === ReleaseStatus::Rejected && $reason) {
            $update['rejection_reason'] = $reason;
        }
        if ($next === ReleaseStatus::Cancelled && $reason) {
            $update['cancellation_reason'] = $reason;
        }
        $release->update($update);
        $this->audit->record($release, 'status_changed', $actorId, $from, $next->value, "Status changed: {$from} → {$next->value}");
        return $release->fresh();
    }

    public function addTasks(EngineeringRelease $release, array $taskIds, ?string $actorId = null): EngineeringRelease
    {
        $existing = $release->task_ids ?? [];
        $merged   = array_values(array_unique(array_merge($existing, $taskIds)));
        $release->update(['task_ids' => $merged, 'task_count' => count($merged)]);
        $this->audit->record($release, 'tasks_added', $actorId, null, null, count($taskIds) . ' tasks added to release');
        return $release->fresh();
    }

    public function removeTasks(EngineeringRelease $release, array $taskIds, ?string $actorId = null): EngineeringRelease
    {
        $updated = array_values(array_filter($release->task_ids ?? [], fn($id) => !in_array($id, $taskIds)));
        $release->update(['task_ids' => $updated, 'task_count' => count($updated)]);
        $this->audit->record($release, 'tasks_removed', $actorId, null, null, count($taskIds) . ' tasks removed from release');
        return $release->fresh();
    }

    public function clone(EngineeringRelease $release, string $newName, ?string $actorId = null): EngineeringRelease
    {
        return DB::transaction(function () use ($release, $newName, $actorId) {
            $clone = EngineeringRelease::create([
                'company_id'      => $release->company_id,
                'name'            => $newName,
                'version'         => null,
                'description'     => $release->description,
                'status'          => ReleaseStatus::Draft->value,
                'release_type'    => $release->release_type,
                'task_ids'        => $release->task_ids,
                'task_count'      => $release->task_count,
                'target_environment' => $release->target_environment,
                'cloned_from_id'  => $release->id,
                'created_by'      => $actorId,
            ]);
            $this->audit->record($clone, 'release_cloned', $actorId, null, ReleaseStatus::Draft->value, "Cloned from release [{$release->id}]");
            return $clone;
        });
    }

    public function archive(EngineeringRelease $release, ?string $actorId = null): EngineeringRelease
    {
        return $this->transition($release, ReleaseStatus::Archived, $actorId);
    }

    public function delete(EngineeringRelease $release, ?string $actorId = null): void
    {
        if ($release->isTerminal() === false && !in_array($release->status, [ReleaseStatus::Draft, ReleaseStatus::Cancelled])) {
            throw new \RuntimeException('Only Draft or Cancelled releases can be deleted');
        }
        $this->audit->record($release, 'release_deleted', $actorId, null, null, 'Release permanently deleted');
        $release->delete();
    }

    public function dashboard(string $companyId): array
    {
        $all = EngineeringRelease::where('company_id', $companyId);
        $total   = (clone $all)->count();
        $draft   = (clone $all)->where('status', 'draft')->count();
        $active  = (clone $all)->whereIn('status', ['collecting','validating','ready','approval_pending','approved','queued','pipeline_running'])->count();
        $pending = (clone $all)->where('status', 'approval_pending')->count();
        $releasedMonth = (clone $all)->where('status', 'released')->where('released_at', '>=', now()->startOfMonth())->count();
        $failed  = (clone $all)->whereIn('status', ['pipeline_failed','rejected'])->count();

        $recent   = EngineeringRelease::where('company_id', $companyId)->orderByDesc('created_at')->limit(5)->get();
        $upcoming = EngineeringRelease::where('company_id', $companyId)->whereIn('status', ['approved','queued'])->orderBy('scheduled_at')->limit(5)->get();

        $readinessAvg = EngineeringRelease::where('company_id', $companyId)
            ->whereIn('status', ['ready','approval_pending','approved'])
            ->avg('readiness_score') ?? 0;

        return [
            'summary'          => compact('total','draft','active','pending','failed') + ['released_this_month' => $releasedMonth],
            'recent_releases'  => $recent,
            'upcoming'         => $upcoming,
            'readiness_avg'    => round((float) $readinessAvg, 1),
        ];
    }
}
