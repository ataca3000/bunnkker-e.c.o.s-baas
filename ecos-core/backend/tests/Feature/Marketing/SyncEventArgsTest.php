<?php

declare(strict_types=1);

namespace Tests\Feature\Marketing;

use Modules\Marketing\Synchronization\Domain\Events\SynchronizationCompleted;
use Modules\Marketing\Synchronization\Domain\Events\SynchronizationFailed;
use Modules\Marketing\Synchronization\Domain\Events\SynchronizationStarted;
use ReflectionClass;
use Tests\TestCase;

/**
 * Regression tests for Synchronization event constructor signatures.
 *
 * Background: RunSyncAction previously called all three events with wrong named
 * args (`syncLogId:` instead of `syncLog:`, `connectorType:` which doesn't
 * exist on any event).  PHP 8 named-argument mismatches are fatal errors that
 * only surface at runtime — these tests surface the mismatch at test time.
 *
 * The tests use two complementary strategies:
 *  1. Reflection — verify the constructor parameter names on each event class.
 *  2. Source scan — verify RunSyncAction uses the correct named args at the
 *     call sites (catches cases where the event classes change but callers
 *     are not updated, or vice versa).
 */
class SyncEventArgsTest extends TestCase
{
    // ── Reflection tests ──────────────────────────────────────────────────────

    public function test_all_sync_events_have_sync_log_not_sync_log_id(): void
    {
        foreach ([
            SynchronizationStarted::class,
            SynchronizationCompleted::class,
            SynchronizationFailed::class,
        ] as $eventClass) {
            $params = $this->paramNames($eventClass);

            $this->assertContains('syncLog', $params, "$eventClass must declare a 'syncLog' parameter.");
            $this->assertNotContains('syncLogId', $params, "$eventClass must NOT declare 'syncLogId' — pass the model object.");
        }
    }

    public function test_synchronization_started_constructor_signature(): void
    {
        $params = $this->paramNames(SynchronizationStarted::class);

        $this->assertContains('syncLog', $params);
        $this->assertContains('connectionId', $params);
        $this->assertContains('syncType', $params);
        $this->assertContains('triggeredBy', $params);
        $this->assertNotContains('connectorType', $params);
    }

    public function test_synchronization_completed_constructor_signature(): void
    {
        $params = $this->paramNames(SynchronizationCompleted::class);

        $this->assertContains('syncLog', $params);
        $this->assertContains('assetsDiscovered', $params);
        $this->assertContains('assetsCreated', $params);
        $this->assertContains('assetsUpdated', $params);
        $this->assertContains('assetsFailed', $params);
        $this->assertNotContains('connectionId', $params);
        $this->assertNotContains('connectorType', $params);
    }

    public function test_synchronization_failed_constructor_signature(): void
    {
        $params = $this->paramNames(SynchronizationFailed::class);

        $this->assertContains('syncLog', $params);
        $this->assertContains('errorMessage', $params);
        $this->assertNotContains('connectionId', $params);
        $this->assertNotContains('connectorType', $params);
    }

    // ── Source-scan tests ─────────────────────────────────────────────────────

    public function test_run_sync_action_passes_sync_log_object_not_id(): void
    {
        $source = (string) file_get_contents(
            base_path('Modules/Marketing/Synchronization/Application/Actions/RunSyncAction.php'),
        );

        $this->assertStringContainsString(
            'syncLog:',
            $source,
            'RunSyncAction must use named arg syncLog: (object) when dispatching Sync events.',
        );
        $this->assertStringNotContainsString(
            'syncLogId:',
            $source,
            'RunSyncAction must NOT use syncLogId: — this caused PHP fatal errors; pass the model.',
        );
        $this->assertStringNotContainsString(
            'connectorType:',
            $source,
            'RunSyncAction must NOT pass connectorType: to Sync events — that field does not exist.',
        );
    }

    public function test_run_sync_action_passes_all_required_args_for_completed_event(): void
    {
        $source = (string) file_get_contents(
            base_path('Modules/Marketing/Synchronization/Application/Actions/RunSyncAction.php'),
        );

        foreach (['assetsDiscovered:', 'assetsCreated:', 'assetsUpdated:', 'assetsFailed:'] as $arg) {
            $this->assertStringContainsString(
                $arg,
                $source,
                "RunSyncAction must pass $arg to SynchronizationCompleted.",
            );
        }
    }

    public function test_run_sync_action_passes_error_message_to_failed_event(): void
    {
        $source = (string) file_get_contents(
            base_path('Modules/Marketing/Synchronization/Application/Actions/RunSyncAction.php'),
        );

        $this->assertStringContainsString(
            'errorMessage:',
            $source,
            'RunSyncAction must pass errorMessage: to SynchronizationFailed.',
        );
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** @return list<string> */
    private function paramNames(string $class): array
    {
        return array_map(
            static fn ($p) => $p->getName(),
            (new ReflectionClass($class))->getConstructor()?->getParameters() ?? [],
        );
    }
}
