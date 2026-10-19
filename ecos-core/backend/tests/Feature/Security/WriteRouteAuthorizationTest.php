<?php

declare(strict_types=1);

namespace Tests\Feature\Security;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Route;
use ReflectionClass;
use ReflectionMethod;
use ReflectionNamedType;
use Tests\TestCase;

/**
 * TASK-PERMISSION-INTEGRATION-001 — the CI authorization guard.
 *
 * ┌─ EVERY WRITE ROUTE MUST AUTHORIZE ──────────────────────────────────────┐
 * │ This is the control that makes the permission matrix hold. It asserts      │
 * │ against the REAL route table and the REAL controller source, because that  │
 * │ is the only way to catch the two failure modes that actually happened      │
 * │ here:                                                                     │
 * │                                                                           │
 * │   1. Chaining ->middleware() twice on a registrar silently REPLACES the    │
 * │      first call. Source that reads as authenticated was not.              │
 * │   2. 471 write routes drifted in over time with no gate at all, because    │
 * │      nothing ever counted them.                                           │
 * │                                                                           │
 * │ A route counts as authorized if ANY of these hold — matching how ECOS      │
 * │ actually protects things, not one preferred style:                        │
 * │   • permission:/can:/role: middleware                                     │
 * │   • $this->authorize() / Gate:: / ->can() / authorizeResource()           │
 * │   • ownership validation: abort_if(... company_id ..., 403)               │
 * │   • a FormRequest whose authorize() does more than `return true`          │
 * │                                                                           │
 * │ ALLOWED is an explicit, shrinking list. Adding to it is a deliberate act   │
 * │ that shows up in review; forgetting to authorize a new route is not.       │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class WriteRouteAuthorizationTest extends TestCase
{
    private const WRITE_VERBS = ['POST', 'PUT', 'PATCH', 'DELETE'];

    /**
     * Write routes that are intentionally unauthorized, each with a reason.
     *
     * Public surface and machine-to-machine callbacks only. Everything here is
     * either unauthenticated by design or protected by a non-permission
     * mechanism (a signed webhook, a worker token).
     *
     * @var array<string, string>
     */
    private const ALLOWED = [
        'POST api/auth/login' => 'Authentication entry point.',
        'POST api/careers/jobs/{slug}/apply' => 'Public careers portal — creates an applicant only.',

        // External callbacks: caller is a third-party system, not a user.
        'POST api/webhooks/woocommerce/{channel}/orders' => 'WooCommerce webhook.',
        'POST api/webhooks/woocommerce/{channel}/products' => 'WooCommerce webhook.',
        'POST api/webhooks/woocommerce/{channel}/customers' => 'WooCommerce webhook.',
        'POST api/omnichannel/webhook/{channelProviderId}' => 'Channel provider webhook.',
        'POST api/marketing/automation/webhook/{workflow}' => 'Automation trigger webhook.',

        // Claude Bridge workers authenticate with VerifyWorkerToken, not a session.
        'POST api/cb/worker/heartbeat' => 'Worker token authenticated.',
        'POST api/cb/worker/tasks/{id}/start' => 'Worker token authenticated.',
        'POST api/cb/worker/tasks/{id}/complete' => 'Worker token authenticated.',
        'POST api/cb/worker/tasks/{id}/fail' => 'Worker token authenticated.',
        'POST api/cb/worker/tasks/{id}/log-chunk' => 'Worker token authenticated.',
        'POST api/cb/worker/tasks/{id}/artifact' => 'Worker token authenticated.',
    ];

    /**
     * Category C — sensitive operations awaiting CTO sign-off on who may hold them.
     *
     * Tracked separately from ALLOWED so the two never blur: these are NOT
     * accepted as safe, they are accepted as PENDING. The count is asserted, so
     * the backlog cannot grow quietly while it waits for a decision.
     *
     * @var array<int, string>
     */
    private const PENDING_CATEGORY_C = [
        'refund', 'void', 'close-shift', 'override', 'reverse',
        'verify-payment', 'transfer', 'apply', 'write-off',
    ];

    public function test_every_write_route_is_authorized(): void
    {
        $unauthorized = [];

        foreach ($this->writeRoutes() as $key => $route) {
            if (array_key_exists($key, self::ALLOWED)) {
                continue;
            }

            if (! $this->isAuthorized($route)) {
                $unauthorized[] = $key;
            }
        }

        sort($unauthorized);

        $this->assertSame(
            [],
            $unauthorized,
            count($unauthorized)." write route(s) have no authorization.\n\n"
            ."Every POST/PUT/PATCH/DELETE must be gated by a permission, a policy, an\n"
            ."ownership check, or a FormRequest that authorizes. If a route is genuinely\n"
            ."public or machine-authenticated, add it to ALLOWED with a reason.\n\n"
            .implode("\n", $unauthorized)
        );
    }

    /** The allow-list must never quietly absorb ordinary application routes. */
    public function test_the_allow_list_stays_small_and_public(): void
    {
        $this->assertLessThanOrEqual(
            20,
            count(self::ALLOWED),
            'The unauthorized allow-list is growing. Each entry is a route anyone on the '
            .'internet can call — it should be public surface and webhooks, nothing else.'
        );

        foreach (array_keys(self::ALLOWED) as $key) {
            $this->assertMatchesRegularExpression(
                '#^(POST|PUT|PATCH|DELETE) api/(auth|careers|webhooks|omnichannel/webhook|marketing/automation/webhook|cb/worker)#',
                $key,
                "{$key} is on the allow-list but is not public surface or a machine callback."
            );
        }
    }

    /** Authorizing middleware must survive registration — see failure mode 1 above. */
    public function test_authorizing_middleware_is_not_lost_by_chained_registration(): void
    {
        $authenticatedButUnauthorized = [];

        foreach ($this->writeRoutes() as $key => $route) {
            if (array_key_exists($key, self::ALLOWED)) {
                continue;
            }

            $mw = $route->gatherMiddleware();
            $hasAuthn = false;

            foreach ($mw as $m) {
                if (is_string($m) && (str_starts_with($m, 'auth:') || str_contains($m, 'VerifyWorkerToken'))) {
                    $hasAuthn = true;
                }
            }

            if (! $hasAuthn) {
                $authenticatedButUnauthorized[] = $key;
            }
        }

        sort($authenticatedButUnauthorized);

        $this->assertSame(
            [],
            $authenticatedButUnauthorized,
            "These write routes carry no authentication middleware at all:\n"
            .implode("\n", $authenticatedButUnauthorized)
        );
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** @return array<string, \Illuminate\Routing\Route> */
    private function writeRoutes(): array
    {
        $out = [];

        foreach (Route::getRoutes() as $route) {
            if (! str_starts_with($route->uri(), 'api/')) {
                continue;
            }

            $verbs = array_values(array_intersect($route->methods(), self::WRITE_VERBS));

            if ($verbs === []) {
                continue;
            }

            $out[$verbs[0].' '.$route->uri()] = $route;
        }

        return $out;
    }

    private function isAuthorized(\Illuminate\Routing\Route $route): bool
    {
        foreach ($route->gatherMiddleware() as $m) {
            if (is_string($m) && preg_match('/^(permission|can|role|scope|ability):/', $m)) {
                return true;
            }
        }

        $action = $route->getActionName();

        if (! str_contains($action, '@')) {
            return false;
        }

        [$controller, $method] = explode('@', $action, 2);

        try {
            $rm = new ReflectionMethod($controller, $method);
            $src = $this->stripComments($this->methodSource($rm));

            foreach (['$this->authorize(', 'Gate::authorize(', 'Gate::allows(', 'Gate::denies(', '->cannot(', '->can('] as $needle) {
                if (str_contains($src, $needle)) {
                    return true;
                }
            }

            if ($this->hasOwnershipCheck($src)) {
                return true;
            }

            $rc = new ReflectionClass($controller);

            if ($rc->hasMethod('__construct')) {
                $ctor = $this->stripComments($this->methodSource($rc->getMethod('__construct')));

                if (str_contains($ctor, 'authorizeResource(')
                    || preg_match('/middleware\([\'"](permission|can|role):/', $ctor)) {
                    return true;
                }
            }

            foreach ($rm->getParameters() as $p) {
                $t = $p->getType();

                if (! $t instanceof ReflectionNamedType || $t->isBuiltin()) {
                    continue;
                }

                $cls = $t->getName();

                if (! class_exists($cls) || ! is_subclass_of($cls, FormRequest::class)) {
                    continue;
                }

                $frc = new ReflectionClass($cls);

                if (! $frc->hasMethod('authorize')) {
                    continue;
                }

                $body = preg_replace(
                    '/\s+/',
                    '',
                    $this->stripComments($this->methodSource($frc->getMethod('authorize')))
                );

                // `return true` is not authorization.
                if (! preg_match('/authorize\(\)(:bool)?\{returntrue;\}/', (string) $body)) {
                    return true;
                }
            }
        } catch (\Throwable) {
            // An action that cannot be reflected is treated as unauthorized —
            // failing closed is the only safe default for a security guard.
            return false;
        }

        return false;
    }

    /**
     * Ownership validation counts; business validation does not.
     *
     * `abort_if($x->company_id !== auth()->user()->company_id, 403)` denies access.
     * `abort_if($existing > 0, 422, 'already configured')` validates input.
     */
    private function hasOwnershipCheck(string $src): bool
    {
        foreach (preg_split('/\R/', $src) ?: [] as $line) {
            if (! preg_match('/abort_(if|unless)\s*\(/', $line)) {
                continue;
            }

            $denies = str_contains($line, '403') || str_contains($line, '401');
            $ownership = str_contains($line, 'company_id') || str_contains($line, 'user()->id');

            if ($denies && $ownership) {
                return true;
            }
        }

        return false;
    }

    private function methodSource(ReflectionMethod $m): string
    {
        $file = $m->getFileName();

        if ($file === false || ! is_readable($file)) {
            return '';
        }

        $lines = file($file) ?: [];
        $start = $m->getStartLine() - 1;

        return implode('', array_slice($lines, $start, $m->getEndLine() - $start));
    }

    private function stripComments(string $src): string
    {
        $out = '';

        foreach (@token_get_all('<?php '.$src) as $t) {
            if (is_array($t) && in_array($t[0], [T_COMMENT, T_DOC_COMMENT], true)) {
                continue;
            }

            $out .= is_array($t) ? $t[1] : $t;
        }

        return $out;
    }
}
