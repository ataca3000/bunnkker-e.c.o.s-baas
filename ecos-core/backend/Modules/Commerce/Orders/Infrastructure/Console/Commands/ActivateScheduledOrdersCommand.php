<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Infrastructure\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Operations\Fulfillment\Application\FulfillmentEngine;
use Modules\Operations\Fulfillment\Application\Workflows\ProcessOrderWorkflow;
use Modules\Operations\Fulfillment\Domain\Exceptions\WorkflowPreconditionException;
use Throwable;

/**
 * ARCH-003 — Activate Scheduled orders whose delivery date has arrived.
 *
 * Runs daily at 00:05 via the Laravel scheduler. For each order in Scheduled
 * status whose requested_delivery_date <= today, the command calls
 * ProcessOrderWorkflow via the FulfillmentEngine. The workflow:
 *
 *   - Attempts inventory reservation
 *   - Routes to AwaitingStock if warehouse unassigned or stock insufficient
 *   - Stamps full audit trail (who, when, previous status)
 *   - Emits domain events for downstream listeners
 *
 * Design decisions:
 *   - Uses chunkById(50) to cap memory footprint for large order volumes.
 *   - ProcessOrderWorkflow.guard() enforces the delivery-date gate; the command
 *     query filter (delivery_date <= today) means the guard never rejects unless
 *     --force overrides both the date filter and the guard simultaneously.
 *   - actorId = null → audit trail records "system" as the actor.
 *   - Per-order exceptions are caught, logged, and counted — one failure does
 *     not abort subsequent orders.
 *   - withoutOverlapping() in the scheduler prevents concurrent activation runs,
 *     providing idempotency at the process level. Status-filter idempotency means
 *     a re-run of the same calendar day is a safe no-op for already-activated orders.
 *
 * Usage:
 *   php artisan orders:activate-scheduled
 *   php artisan orders:activate-scheduled --company=<uuid>
 *   php artisan orders:activate-scheduled --dry-run
 *   php artisan orders:activate-scheduled --force
 */
final class ActivateScheduledOrdersCommand extends Command
{
    protected $signature = 'orders:activate-scheduled
                            {--company= : Limit to a specific company UUID}
                            {--dry-run  : List eligible orders without activating them}
                            {--force    : Bypass delivery-date guard — activate regardless of requested_delivery_date}';

    protected $description = 'Activate Scheduled orders whose delivery date has arrived';

    public function handle(
        FulfillmentEngine $engine,
        ProcessOrderWorkflow $workflow,
    ): int {
        $today = now()->toDateString();
        $dryRun = (bool) $this->option('dry-run');
        $force = (bool) $this->option('force');
        $companyId = $this->option('company');

        $this->info(sprintf(
            '[%s] Activating Scheduled orders due on or before %s%s%s',
            now()->toDateTimeString(),
            $today,
            $dryRun ? ' (dry-run)' : '',
            $force ? ' (FORCE)' : '',
        ));

        $query = Order::query()
            ->where('status', OrderStatus::Scheduled->value);

        // Without --force only pick up orders whose delivery window has opened.
        if (! $force) {
            $query->where(function ($q) use ($today): void {
                $q->whereDate('requested_delivery_date', '<=', $today)
                    ->orWhereNull('requested_delivery_date');
            });
        }

        if ($companyId !== null) {
            $query->where('company_id', $companyId);
        }

        $activated = 0;
        $skipped = 0;
        $failed = 0;

        // force_activate=true bypasses the delivery-date guard inside ProcessOrderWorkflow.
        $ctx = $force ? ['force_activate' => true] : [];

        $query->chunkById(50, function ($orders) use ($engine, $workflow, $dryRun, $ctx, &$activated, &$skipped, &$failed): void {
            foreach ($orders as $order) {
                if ($dryRun) {
                    $this->line(sprintf(
                        '  DRY-RUN  #%s  [%s]  delivery=%s',
                        $order->order_number,
                        $order->id,
                        $order->requested_delivery_date ?? 'none',
                    ));
                    $skipped++;

                    continue;
                }

                try {
                    $result = $engine->run($workflow, $order, $ctx, null);

                    $this->line(sprintf(
                        '  ACTIVATED  #%s → %s',
                        $order->order_number,
                        $result->order->status->value,
                    ));
                    $activated++;
                } catch (WorkflowPreconditionException $e) {
                    // Guard blocked activation (e.g. date mismatch when running without --force).
                    $this->warn("  SKIP   #{$order->order_number} — {$e->getMessage()}");
                    $skipped++;
                } catch (Throwable $e) {
                    $this->error("  FAIL   #{$order->order_number} — {$e->getMessage()}");
                    Log::channel('daily')->error('[ActivateScheduledOrders] Failed', [
                        'order_id' => $order->id,
                        'order_number' => $order->order_number,
                        'error' => $e->getMessage(),
                        'trace' => $e->getTraceAsString(),
                    ]);
                    $failed++;
                }
            }
        });

        $this->newLine();
        $this->table(
            ['Metric', 'Count'],
            [
                ['Activated', $activated],
                ['Skipped',   $skipped],
                ['Failed',    $failed],
            ],
        );

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }
}
