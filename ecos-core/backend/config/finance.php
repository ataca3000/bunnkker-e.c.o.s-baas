<?php

declare(strict_types=1);

/**
 * Finance platform configuration.
 *
 * ┌─ WHY THIS FILE EXISTS ──────────────────────────────────────────────────┐
 * │ FinanceServiceProvider read `config('finance.integration.auto_subscribe')` │
 * │ while this file did not exist, so the inline default applied and the       │
 * │ posting bridge was permanently disabled — silently. Nothing errored;       │
 * │ posting simply never happened. A config key with no config file is an      │
 * │ invisible off-switch, which is the worst kind.                             │
 * │                                                                            │
 * │ Every finance setting now lives here with an explicit value, so the state  │
 * │ of the platform is readable rather than inferred from a missing file.      │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return [

    /*
    |--------------------------------------------------------------------------
    | Integration — the operational event → journal bridge
    |--------------------------------------------------------------------------
    */
    'integration' => [

        /**
         * Subscribe the posting bridge to the domain event bus.
         *
         * ON by default (activated by TASK-FIN-002). This makes operational
         * events post real journals, so the failure mode is what matters: a
         * posting that cannot resolve its accounts is parked in the dead-letter
         * queue, never guessed at, and the operational transaction is unaffected.
         * With posting_mode = queued and per-event idempotency receipts, an
         * unreviewed Chart of Accounts yields dead letters, not wrong numbers.
         *
         * Set FINANCE_AUTO_SUBSCRIBE=false to take the bridge offline in an
         * environment whose CoA or fiscal periods have not been reviewed.
         *
         * (This block previously read "DEFAULT OFF, DELIBERATELY" while the code
         * below defaulted to true — the comment and the value disagreed.)
         */
        'auto_subscribe' => env('FINANCE_AUTO_SUBSCRIBE', true),

        /** Queue that carries financial event processing. */
        'queue' => env('FINANCE_POSTING_QUEUE', 'finance-posting'),

        /** Subscriber priority on the bus. Higher runs earlier. */
        'subscriber_priority' => 200,

        /**
         * sync   — post inline, inside the caller's request
         * queued — hand to the queue and return immediately (recommended)
         */
        'posting_mode' => env('FINANCE_POSTING_MODE', 'queued'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Retry policy
    |--------------------------------------------------------------------------
    | A posting failure is usually transient (a locked period being opened, a
    | deadlock). Retries are bounded and backed off; what survives them is a
    | genuine problem and belongs in the dead-letter queue, not in a loop.
    */
    'retry' => [
        'max_attempts' => env('FINANCE_POSTING_MAX_ATTEMPTS', 3),
        'backoff_seconds' => [10, 60, 300],
        'timeout_seconds' => 120,
    ],

    /*
    |--------------------------------------------------------------------------
    | Dead letters
    |--------------------------------------------------------------------------
    | An event that cannot be posted is PARKED, never dropped and never guessed
    | at. Retention is long because an unposted financial event is evidence of a
    | gap in the books and must outlive the incident that caused it.
    */
    'dead_letter' => [
        'enabled' => true,
        'retention_days' => env('FINANCE_DEAD_LETTER_RETENTION_DAYS', 365),
        'alert_threshold' => env('FINANCE_DEAD_LETTER_ALERT_THRESHOLD', 10),
        'auto_replay' => false,
    ],

    /*
    |--------------------------------------------------------------------------
    | Event processing
    |--------------------------------------------------------------------------
    */
    'events' => [
        /** Idempotency: a receipt per source event id, so redelivery posts once. */
        'idempotency_enabled' => true,
        'receipt_retention_days' => env('FINANCE_RECEIPT_RETENTION_DAYS', 730),

        /**
         * Reject an event whose schema version this build does not understand,
         * rather than reading it optimistically and posting a wrong number.
         */
        'strict_version_check' => env('FINANCE_STRICT_VERSION_CHECK', true),

        /** Schema version this build emits and considers current. */
        'current_schema_version' => 1,

        /** Schema versions this build can still read. */
        'supported_schema_versions' => [1],
    ],

    /*
    |--------------------------------------------------------------------------
    | Logging & tracing
    |--------------------------------------------------------------------------
    */
    'logging' => [
        'enabled' => true,
        'channel' => env('FINANCE_LOG_CHANNEL', 'stack'),
        'level' => env('FINANCE_LOG_LEVEL', 'info'),
        /** Log every posting attempt, not only failures — the audit needs both. */
        'log_successful_postings' => true,
    ],

    'tracing' => [
        'enabled' => env('FINANCE_TRACING_ENABLED', true),
        /** Keep the full rule → account → line derivation for each posting. */
        'capture_rule_resolution' => true,
        'retention_days' => env('FINANCE_TRACE_RETENTION_DAYS', 180),
    ],

    /*
    |--------------------------------------------------------------------------
    | Ledger defaults
    |--------------------------------------------------------------------------
    */
    'ledger' => [
        'base_currency' => env('FINANCE_BASE_CURRENCY', 'EGP'),
        'decimal_precision' => 2,
        /** Maker-checker: the poster may not approve their own journal. */
        'enforce_segregation_of_duties' => true,
    ],
];
