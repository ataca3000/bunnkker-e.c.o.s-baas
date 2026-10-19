<?php

declare(strict_types=1);

namespace Modules\ClaudeBridge\Presentation\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Modules\ClaudeBridge\Domain\Contracts\WorkerRepositoryInterface;
use Symfony\Component\HttpFoundation\Response;

final class VerifyWorkerToken
{
    public function __construct(private readonly WorkerRepositoryInterface $workers) {}

    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (! $token) {
            return response()->json(['error' => ['code' => 'INVALID_TOKEN', 'message' => 'No token provided.']], 401);
        }

        $worker = $this->workers->findByToken($token);

        if (! $worker) {
            return response()->json(['error' => ['code' => 'INVALID_TOKEN', 'message' => 'Invalid token.']], 401);
        }

        if (! $worker->is_active) {
            return response()->json(['error' => ['code' => 'FORBIDDEN', 'message' => 'Worker is deactivated.']], 403);
        }

        $request->attributes->set('cb_worker', $worker);

        return $next($request);
    }
}
