<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Modules\System\Engineering\Domain\Contracts\EngineeringRunRepositoryInterface;
use Modules\System\Engineering\Domain\Models\EngineeringFinding;
use Modules\System\Engineering\Domain\Models\EngineeringRun;

/**
 * Reads cert-*.json files from engineering/certification/reports/ and imports
 * them into the database. Does NOT execute shell scripts — guardians write
 * JSON to disk independently and this service only reads those files.
 */
final class ImportEngineeringReportService
{
    public function __construct(
        private readonly EngineeringRunRepositoryInterface $repository,
    ) {}

    /**
     * Import all unimported report files from the reports directory.
     * Returns the number of new runs imported.
     */
    public function importAll(): int
    {
        $reportDir = base_path('engineering/certification/reports');

        if (! is_dir($reportDir)) {
            Log::warning('[Engineering] Reports directory not found', ['path' => $reportDir]);
            return 0;
        }

        $files = glob("{$reportDir}/cert-*.json") ?: [];

        if (empty($files)) {
            return 0;
        }

        // Sort ascending so the oldest file is imported first
        sort($files);

        $imported = 0;
        foreach ($files as $file) {
            if ($this->repository->findByReportFile($file) !== null) {
                continue; // Already imported
            }

            try {
                $this->importFile($file);
                $imported++;
            } catch (\Throwable $e) {
                Log::error('[Engineering] Failed to import report file', [
                    'file'  => $file,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $imported;
    }

    /**
     * Import a single report file, creating EngineeringRun + EngineeringFinding records.
     */
    public function importFile(string $filePath): EngineeringRun
    {
        $raw = file_get_contents($filePath);
        if ($raw === false) {
            throw new \RuntimeException("Cannot read file: {$filePath}");
        }

        $payload = json_decode($raw, true);
        if (! is_array($payload) || ! isset($payload['ecos_certification'])) {
            throw new \RuntimeException("Invalid certification JSON in: {$filePath}");
        }

        $cert = $payload['ecos_certification'];

        return DB::transaction(function () use ($cert, $filePath, $payload): EngineeringRun {
            $certifiedAt = isset($cert['generated_at'])
                ? Carbon::parse($cert['generated_at'])
                : Carbon::now();

            $run = EngineeringRun::create([
                'branch'        => $cert['branch'] ?? 'unknown',
                'commit'        => $cert['commit'] ?? null,
                'mode'          => $cert['mode'] ?? 'full',
                'overall_score' => (int) ($cert['overall_score'] ?? 0),
                'release_ready' => (bool) ($cert['release_ready'] ?? false),
                'categories'    => $cert['categories'] ?? [],
                'metrics'       => $cert['metrics'] ?? [],
                'blockers'      => $cert['blockers'] ?? [],
                'report_json'   => $payload,
                'report_file'   => $filePath,
                'certified_at'  => $certifiedAt,
            ]);

            // Import individual findings if present in the JSON
            if (! empty($cert['findings']) && is_array($cert['findings'])) {
                foreach ($cert['findings'] as $f) {
                    EngineeringFinding::create([
                        'engineering_run_id' => $run->id,
                        'severity'           => strtoupper($f['severity'] ?? 'LOW'),
                        'category'           => $f['category'] ?? 'unknown',
                        'file'               => $f['file'] ?? null,
                        'line'               => isset($f['line']) ? (int) $f['line'] : null,
                        'title'              => Str::limit($f['title'] ?? 'Finding', 255),
                        'description'        => $f['description'] ?? null,
                        'fix_suggestion'     => $f['fix'] ?? null,
                    ]);
                }
            } else {
                // Synthesize findings from blockers and category failures when
                // the JSON has no detailed findings array (older cert format).
                $this->synthesizeFindings($run, $cert);
            }

            return $run;
        });
    }

    /**
     * Create summary-level findings from blockers + failed categories when
     * the certification JSON does not include a detailed findings array.
     */
    private function synthesizeFindings(EngineeringRun $run, array $cert): void
    {
        // Blockers → HIGH findings
        foreach ($cert['blockers'] ?? [] as $blocker) {
            $severity = str_contains(strtoupper($blocker), 'CRITICAL') ? 'CRITICAL' : 'HIGH';
            EngineeringFinding::create([
                'engineering_run_id' => $run->id,
                'severity'           => $severity,
                'category'           => 'blocker',
                'file'               => null,
                'line'               => null,
                'title'              => Str::limit($blocker, 255),
                'description'        => $blocker,
                'fix_suggestion'     => 'Resolve the blocker before releasing.',
            ]);
        }

        // FAIL categories → MEDIUM findings
        foreach ($cert['categories'] ?? [] as $key => $cat) {
            if (($cat['status'] ?? '') === 'FAIL') {
                EngineeringFinding::create([
                    'engineering_run_id' => $run->id,
                    'severity'           => 'MEDIUM',
                    'category'           => "category-{$key}",
                    'file'               => null,
                    'line'               => null,
                    'title'              => ucfirst($key) . ' category failed (score: ' . ($cat['score'] ?? 0) . '/100)',
                    'description'        => "The {$key} certification category scored " . ($cat['score'] ?? 0) . "/100 (FAIL threshold is 80).",
                    'fix_suggestion'     => "Run the {$key} guardian and resolve all reported violations.",
                ]);
            }
        }
    }
}
