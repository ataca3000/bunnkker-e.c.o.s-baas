<?php

declare(strict_types=1);

return [
    /*
    |--------------------------------------------------------------------------
    | Auto Deploy
    |--------------------------------------------------------------------------
    | Controls whether the Deployment Guardian stage automatically triggers
    | a production deployment. Requires explicit opt-in via env.
    */
    'auto_deploy' => (bool) env('ENGINEERING_AUTO_DEPLOY', false),

    /*
    |--------------------------------------------------------------------------
    | CI Provider
    |--------------------------------------------------------------------------
    | The active CI/CD provider. Built-in: "github".
    | Future: "gitlab", "azure_devops", "jenkins", "bitbucket".
    */
    'ci_provider' => env('ENGINEERING_CI_PROVIDER', 'github'),

    /*
    |--------------------------------------------------------------------------
    | Provider Configurations
    |--------------------------------------------------------------------------
    */
    'providers' => [
        'github' => [
            'class'                => \Modules\System\Engineering\Infrastructure\Providers\CI\GitHubCiProvider::class,
            'poll_interval_seconds' => (int) env('ENGINEERING_GH_POLL_INTERVAL', 30),
            'max_wait_seconds'     => (int) env('ENGINEERING_GH_MAX_WAIT', 600),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Default Pipeline Behavior
    |--------------------------------------------------------------------------
    */
    'defaults' => [
        'template' => env('ENGINEERING_DEFAULT_TEMPLATE', 'release'),
        'branch'   => env('ENGINEERING_DEFAULT_BRANCH', 'main'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Real-time Update Transport
    |--------------------------------------------------------------------------
    | "polling" uses the existing 3-second polling approach.
    | "sse" and "websocket" are reserved for future implementation.
    */
    'realtime' => [
        'driver'                   => env('ENGINEERING_REALTIME_DRIVER', 'polling'),
        'polling_interval_seconds' => (int) env('ENGINEERING_POLL_INTERVAL', 3),
    ],

    /*
    |--------------------------------------------------------------------------
    | Pipeline Permissions
    |--------------------------------------------------------------------------
    | Role slugs that are allowed per pipeline action.
    | If empty array, the action is unrestricted (auth:sanctum only).
    */
    'permissions' => [
        'view'    => [],
        'execute' => [],
        'retry'   => [],
        'cancel'  => [],
        'approve' => [],
        'admin'   => [],
    ],

    /*
    |--------------------------------------------------------------------------
    | Analytics Lookback Window
    |--------------------------------------------------------------------------
    */
    'analytics' => [
        'lookback_days'    => (int) env('ENGINEERING_ANALYTICS_DAYS', 30),
        'recent_pipelines' => (int) env('ENGINEERING_ANALYTICS_RECENT', 10),
    ],

    /*
    |--------------------------------------------------------------------------
    | Self-Healing (TASK-ENG-V2-002)
    |--------------------------------------------------------------------------
    | Controls automated patch generation and validation. The php_syntax
    | command receives the file path appended per-file at runtime; eslint
    | receives affected .ts/.tsx paths appended.
    */
    'self_healing' => [
        'enabled' => env('ENG_SELF_HEALING_ENABLED', true),
        'require_validation_before_apply' => env('ENG_REQUIRE_PATCH_VALIDATION', false),
        'max_attempts' => env('ENG_VALIDATION_MAX_ATTEMPTS', 3),
        // Fail-fast: stop the sequence at the first blocking failure and
        // auto-rollback applied patches. False restores run-all reporting.
        'fail_fast' => env('ENG_VALIDATION_FAIL_FAST', true),
        'working_directory' => env('ENG_VALIDATION_WORKDIR', base_path()),
        'commands' => [
            'php_syntax' => ['php', '-l'],
            'composer' => ['composer', 'validate', '--no-check-publish'],
            'laravel_validation' => ['php', 'artisan', 'about'],
            'pint' => ['./vendor/bin/pint', '--test'],
            'phpstan' => ['./vendor/bin/phpstan', 'analyse', '--no-progress', '--error-format=raw'],
            'eslint' => ['npx', 'eslint', '--max-warnings', '0'],
            'typescript' => ['npx', 'tsc', '--noEmit'],
            'build' => ['npm', 'run', 'build'],
            'tests' => ['php', 'artisan', 'test'],
            'frontend_tests' => ['npm', 'run', 'test'],
        ],
        'limits' => [
            'max_files_per_patch' => env('ENG_PATCH_MAX_FILES', 25),
            'max_lines_per_patch' => env('ENG_PATCH_MAX_LINES', 2000),
        ],
        'forbidden_paths' => ['.env', '.env.', 'vendor/', 'node_modules/', '.git/', 'composer.lock', 'package-lock.json', 'storage/'],
    ],

    /*
    |--------------------------------------------------------------------------
    | Guardian V2 (TASK-ENG-V2-003)
    |--------------------------------------------------------------------------
    | enforce_in_pipeline=false keeps the legacy advisory behavior of the
    | DevelopmentGuardian pipeline stage; true makes the stage delegate to
    | GuardianEngine and block on failures.
    */
    'guardian' => [
        'enabled' => env('ENG_GUARDIAN_ENABLED', true),
        'enforce_in_pipeline' => env('ENG_GUARDIAN_ENFORCE_PIPELINE', false),
        'toolchain_checks' => ['php_syntax', 'pint', 'eslint'],
        'default_policy' => [
            'name' => 'Built-in Default',
            'auto_repair' => true,
            'block_on' => ['security', 'adr_compliance', 'safety', 'toolchain'],
            'enabled_checks' => null,
            'max_repair_attempts' => 2,
            'require_revalidation' => true,
        ],
    ],
];
