<?php

declare(strict_types=1);

namespace App\Contracts;

/**
 * Marker contract implemented by all application/domain services.
 *
 * Services orchestrate reusable, cross-cutting operations. This interface
 * intentionally declares no methods: it exists to type-hint, group, and bind
 * services consistently across modules. The framework provides
 * {@see \App\Core\Services\BaseService} as a base implementation.
 */
interface ServiceInterface {}
