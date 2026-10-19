<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS)
    |--------------------------------------------------------------------------
    |
    | allowed_origins is intentionally driven by CORS_ALLOWED_ORIGINS so the
    | same image can be configured per-environment without a rebuild:
    |
    |   Development / pilot:   CORS_ALLOWED_ORIGINS=http://localhost
    |   Production:            CORS_ALLOWED_ORIGINS=https://app.yourdomain.com
    |
    | Never set CORS_ALLOWED_ORIGINS=* in production.
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_filter(
        array_map('trim', explode(',', (string) env('CORS_ALLOWED_ORIGINS', 'http://localhost'))),
    ),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => (bool) env('CORS_SUPPORTS_CREDENTIALS', false),

];
