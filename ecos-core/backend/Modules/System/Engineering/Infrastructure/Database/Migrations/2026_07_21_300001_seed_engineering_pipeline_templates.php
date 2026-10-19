<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    private function makeStages(array $overrides = []): array
    {
        $defaults = [
            ['handler' => 'development_guardian',  'label' => 'Development Guardian',  'order' => 1,  'enabled' => true,  'retry_policy' => ['max_retries' => 0, 'backoff_strategy' => 'fixed', 'retry_delay_seconds' => 5,  'timeout_seconds' => 120]],
            ['handler' => 'architecture_guardian', 'label' => 'Architecture Guardian', 'order' => 2,  'enabled' => true,  'retry_policy' => ['max_retries' => 0, 'backoff_strategy' => 'fixed', 'retry_delay_seconds' => 5,  'timeout_seconds' => 60]],
            ['handler' => 'build',                 'label' => 'Build',                 'order' => 3,  'enabled' => true,  'retry_policy' => ['max_retries' => 2, 'backoff_strategy' => 'linear', 'retry_delay_seconds' => 10, 'timeout_seconds' => 300]],
            ['handler' => 'tests',                 'label' => 'Tests',                 'order' => 4,  'enabled' => true,  'retry_policy' => ['max_retries' => 1, 'backoff_strategy' => 'fixed',  'retry_delay_seconds' => 5,  'timeout_seconds' => 300]],
            ['handler' => 'commit',                'label' => 'Auto Commit',           'order' => 5,  'enabled' => true,  'retry_policy' => ['max_retries' => 0, 'backoff_strategy' => 'fixed', 'retry_delay_seconds' => 0,  'timeout_seconds' => 60]],
            ['handler' => 'push',                  'label' => 'Auto Push',             'order' => 6,  'enabled' => true,  'retry_policy' => ['max_retries' => 0, 'backoff_strategy' => 'fixed', 'retry_delay_seconds' => 0,  'timeout_seconds' => 120]],
            ['handler' => 'github_actions',        'label' => 'GitHub Actions',        'order' => 7,  'enabled' => true,  'retry_policy' => ['max_retries' => 3, 'backoff_strategy' => 'fixed',  'retry_delay_seconds' => 30, 'timeout_seconds' => 600]],
            ['handler' => 'deployment_guardian',   'label' => 'Deployment Guardian',   'order' => 8,  'enabled' => true,  'retry_policy' => ['max_retries' => 0, 'backoff_strategy' => 'fixed', 'retry_delay_seconds' => 0,  'timeout_seconds' => 30]],
            ['handler' => 'certification',         'label' => 'Certification',         'order' => 9,  'enabled' => true,  'retry_policy' => ['max_retries' => 0, 'backoff_strategy' => 'fixed', 'retry_delay_seconds' => 0,  'timeout_seconds' => 600]],
            ['handler' => 'health_check',          'label' => 'Health Check',          'order' => 10, 'enabled' => true,  'retry_policy' => ['max_retries' => 3, 'backoff_strategy' => 'linear', 'retry_delay_seconds' => 5,  'timeout_seconds' => 30]],
            ['handler' => 'notifications',         'label' => 'Notifications',         'order' => 11, 'enabled' => true,  'retry_policy' => ['max_retries' => 0, 'backoff_strategy' => 'fixed', 'retry_delay_seconds' => 0,  'timeout_seconds' => 10]],
        ];

        foreach ($overrides as $handler => $patch) {
            foreach ($defaults as &$stage) {
                if ($stage['handler'] === $handler) {
                    $stage = array_merge($stage, $patch);
                }
            }
            unset($stage);
        }

        return $defaults;
    }

    public function up(): void
    {
        $now = now()->toDateTimeString();

        // Release pipeline — full 11-stage flow
        DB::table('engineering_pipeline_templates')->insert([
            'id'          => Str::uuid()->toString(),
            'name'        => 'Release Pipeline',
            'slug'        => 'release',
            'description' => 'Full release: Guardian → Build → Tests → Commit → Push → CI → Certification → Health Check → Notify',
            'version'     => 1,
            'is_active'   => true,
            'is_system'   => true,
            'stages'      => json_encode($this->makeStages()),
            'metadata'    => json_encode(['color' => 'blue', 'icon' => 'zap']),
            'created_at'  => $now,
            'updated_at'  => $now,
        ]);

        // Hotfix pipeline — skip build, skip certification
        DB::table('engineering_pipeline_templates')->insert([
            'id'          => Str::uuid()->toString(),
            'name'        => 'Hotfix Pipeline',
            'slug'        => 'hotfix',
            'description' => 'Expedited hotfix: Guardian → Tests → Commit → Push → CI → Health Check → Notify (skips Build + Certification)',
            'version'     => 1,
            'is_active'   => true,
            'is_system'   => true,
            'stages'      => json_encode($this->makeStages([
                'build'         => ['enabled' => false],
                'certification' => ['enabled' => false],
            ])),
            'metadata'    => json_encode(['color' => 'red', 'icon' => 'flame']),
            'created_at'  => $now,
            'updated_at'  => $now,
        ]);

        // Documentation pipeline — no CI, no deployment
        DB::table('engineering_pipeline_templates')->insert([
            'id'          => Str::uuid()->toString(),
            'name'        => 'Documentation Pipeline',
            'slug'        => 'documentation',
            'description' => 'Docs-only: Guardian → Commit → Push → Notify (no Build/Tests/CI/Certification)',
            'version'     => 1,
            'is_active'   => true,
            'is_system'   => true,
            'stages'      => json_encode($this->makeStages([
                'build'               => ['enabled' => false],
                'tests'               => ['enabled' => false],
                'github_actions'      => ['enabled' => false],
                'deployment_guardian' => ['enabled' => false],
                'certification'       => ['enabled' => false],
                'health_check'        => ['enabled' => false],
            ])),
            'metadata'    => json_encode(['color' => 'green', 'icon' => 'book']),
            'created_at'  => $now,
            'updated_at'  => $now,
        ]);
    }

    public function down(): void
    {
        DB::table('engineering_pipeline_templates')
            ->whereIn('slug', ['release', 'hotfix', 'documentation'])
            ->delete();
    }
};
