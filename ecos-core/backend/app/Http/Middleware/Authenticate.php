<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Illuminate\Http\Request;

class Authenticate extends Middleware
{
    // Returning null prevents route('login') from being called.
    // The framework evaluates redirectTo() as a constructor argument to
    // AuthenticationException — if route('login') throws, the
    // AuthenticationException is never created and the exception handler
    // never gets a chance to intercept it.
    protected function redirectTo(Request $request): ?string
    {
        if ($request->is('api/*') || $request->expectsJson()) {
            return null;
        }

        return route('login');
    }
}
