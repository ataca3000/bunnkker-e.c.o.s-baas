<?php

declare(strict_types=1);

namespace App\Http\Controllers\Infrastructure;

use Illuminate\Contracts\Queue\Factory as QueueFactory;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Throwable;

class HealthController
{
    /**
     * Each dependency check is wrapped independently.
     * A failure in one check must never prevent the others from running.
     * The response always contains all fields regardless of which checks fail.
     *
     * HTTP 200  → database + redis + queue all healthy (nginx healthcheck passes)
     * HTTP 503  → at least one core dependency unreachable
     *
     * storage, scheduler, disk_free, memory are informational — they do not
     * influence the status code so a storage issue does not cascade into
     * container restart loops via the Docker/nginx healthcheck.
     */
    public function __invoke(): JsonResponse
    {
        $database = false;
        $redis = false;
        $queue = false;
        $storage = false;
        $scheduler = false;

        // 1. Database — attempt PDO connection
        try {
            DB::connection()->getPdo();
            $database = true;
        } catch (Throwable) {
        }

        // 2. Redis — ping the configured connection
        try {
            Redis::ping();
            $redis = true;
        } catch (Throwable) {
        }

        // 3. Queue — driver-independent size check
        //    redis   → LLEN on the queue key
        //    database → SELECT COUNT(*) on jobs table
        //    sync    → returns 0 immediately (always healthy)
        try {
            app(QueueFactory::class)->connection()->size();
            $queue = true;
        } catch (Throwable) {
        }

        // 4. Storage — all four framework directories must be writable.
        //    If any are read-only, Blade compilation and session writes fail.
        try {
            $storage = is_writable(storage_path('logs'))
                    && is_writable(storage_path('framework/cache'))
                    && is_writable(storage_path('framework/sessions'))
                    && is_writable(storage_path('framework/views'));
        } catch (Throwable) {
        }

        // 5. Scheduler — check whether artisan schedule:work is in the process list.
        //
        //    This reads /proc directly rather than shelling out to pgrep.
        //    pgrep lives in procps, which is not installed in the runtime image,
        //    so the previous implementation reported scheduler=false permanently
        //    even while Supervisor had schedule:work RUNNING (TASK-CUTOVER-001,
        //    finding C-4). A permanently-false health field is worse than no
        //    field: operators learn to ignore it, and a real outage goes unseen.
        //
        //    /proc is provided by the kernel, needs no package, and does not
        //    depend on shell_exec being enabled. Each /proc/<pid>/cmdline holds
        //    the argv vector NUL-separated. A process that has exited between
        //    glob() and read simply yields false and is skipped.
        $scheduler = $this->processMatching('artisan schedule');

        // 6. Build metadata — missing file is non-fatal
        $buildInfo = [];
        try {
            $path = public_path('build-info');
            if (file_exists($path)) {
                $buildInfo = json_decode((string) file_get_contents($path), true) ?? [];
            }
        } catch (Throwable) {
        }

        // 7. System resources — informational; absent on failure, never 503
        $diskFree = null;
        $memoryUsage = null;
        try {
            $free = disk_free_space(storage_path());
            $diskFree = $free !== false
                ? round($free / 1_073_741_824, 2).' GB'
                : null;
        } catch (Throwable) {
        }
        try {
            $used = memory_get_usage(true);
            $limit = ini_get('memory_limit');
            $memoryUsage = round($used / 1_048_576, 1).' MB / '.$limit;
        } catch (Throwable) {
        }

        $healthy = $database && $redis && $queue;

        return response()->json([
            'status' => $healthy ? 'ok' : 'degraded',
            'environment' => app()->environment(),
            'version' => $buildInfo['version'] ?? 'unknown',
            'git_sha' => $buildInfo['commit'] ?? 'unknown',
            'built_at' => $buildInfo['built_at'] ?? 'unknown',
            'database' => $database,
            'redis' => $redis,
            'queue' => $queue,
            'storage' => $storage,
            'scheduler' => $scheduler,
            'queue_workers' => $this->countProcessesMatching('artisan queue:work'),
            'disk_free' => $diskFree,
            'memory' => $memoryUsage,
            'timestamp' => now()->toIso8601String(),
        ], $healthy ? 200 : 503);
    }

    /**
     * Count running processes whose command line contains $needle.
     *
     * Reads /proc directly. No external binary (procps is not installed in the
     * runtime image) and no dependency on shell_exec. Returns 0 on any platform
     * without /proc, which is the correct conservative answer.
     */
    private function countProcessesMatching(string $needle): int
    {
        $count = 0;

        try {
            foreach (glob('/proc/[0-9]*/cmdline') ?: [] as $path) {
                // A process may exit between glob() and read; that yields false.
                $cmdline = @file_get_contents($path);

                if ($cmdline === false || $cmdline === '') {
                    continue;
                }

                // argv is NUL-separated in /proc/<pid>/cmdline.
                if (str_contains(str_replace("\0", ' ', $cmdline), $needle)) {
                    $count++;
                }
            }
        } catch (Throwable) {
            return 0;
        }

        return $count;
    }

    /** Whether at least one running process matches $needle. */
    private function processMatching(string $needle): bool
    {
        return $this->countProcessesMatching($needle) > 0;
    }
}
