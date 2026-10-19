<?php

declare(strict_types=1);

return [
    'storage_disk' => env('CLAUDE_BRIDGE_STORAGE_DISK', 'local'),

    'storage_root' => 'claude-bridge',

    'storage_paths' => [
        'tasks' => 'claude-bridge/tasks',
        'logs' => 'claude-bridge/logs',
        'reports' => 'claude-bridge/reports',
        'diffs' => 'claude-bridge/diffs',
    ],

    'worker' => [
        'offline_threshold_seconds' => env('CLAUDE_BRIDGE_OFFLINE_THRESHOLD', 120),
        'token_prefix' => 'cb_tok_',
        'token_bytes' => 32,
    ],

    'execution' => [
        'timeout_seconds' => env('CLAUDE_BRIDGE_EXECUTION_TIMEOUT', 1800),
        'max_attempts' => env('CLAUDE_BRIDGE_MAX_ATTEMPTS', 3),
        'log_chunk_size' => 20,
        'poll_interval' => env('CLAUDE_BRIDGE_POLL_INTERVAL', 10),
        'heartbeat_interval' => env('CLAUDE_BRIDGE_HEARTBEAT_INTERVAL', 30),
    ],

    'retention' => [
        'artifacts_days' => env('CLAUDE_BRIDGE_ARTIFACT_RETENTION_DAYS', 90),
        'tasks_days' => env('CLAUDE_BRIDGE_TASK_RETENTION_DAYS', 365),
    ],
];
