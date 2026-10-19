<?php

declare(strict_types=1);

namespace Modules\Inventory\Products\Application\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Modules\Inventory\Products\Domain\Models\Product;

/**
 * Repairs legacy absolute image URLs left over from old Cloudflare tunnel deployments.
 *
 * Before: https://<tunnel>.trycloudflare.com/storage/raw-materials/01ABC.webp
 * After:  raw-materials/01ABC.webp
 *
 * Only records where image_url starts with http:// or https:// are touched.
 * Records whose file no longer exists in storage are reported but not modified.
 */
final class RepairImageUrlsCommand extends Command
{
    protected $signature = 'inventory:repair-image-urls
                            {--dry-run : Audit and report without writing any changes}';

    protected $description = 'Repair legacy absolute image URLs in the products table (strips the host, keeps the relative storage path)';

    public function handle(): int
    {
        $isDryRun = (bool) $this->option('dry-run');

        if ($isDryRun) {
            $this->warn('[dry-run] No database changes will be written.');
        }

        $scanned = 0;
        $repaired = 0;
        $skipped = 0;
        $missing = [];

        Product::query()
            ->whereNotNull('image_url')
            ->where(function ($q): void {
                $q->where('image_url', 'like', 'http://%')
                    ->orWhere('image_url', 'like', 'https://%');
            })
            ->orderBy('name')
            ->each(function (Product $product) use (
                $isDryRun,
                &$scanned,
                &$repaired,
                &$skipped,
                &$missing,
            ): void {
                $scanned++;
                $raw = (string) $product->image_url;

                $storagePos = strpos($raw, '/storage/');

                if ($storagePos === false) {
                    $this->line("  <comment>SKIP</comment>  [{$product->id}] {$product->name} — no /storage/ segment in URL: {$raw}");
                    $skipped++;

                    return;
                }

                $relativePath = substr($raw, $storagePos + strlen('/storage/'));

                if ($relativePath === '' || $relativePath === '/') {
                    $this->line("  <comment>SKIP</comment>  [{$product->id}] {$product->name} — relative path is empty after stripping host");
                    $skipped++;

                    return;
                }

                if (! Storage::disk('public')->exists($relativePath)) {
                    $this->line("  <error>MISS</error>   [{$product->id}] {$product->name} — file not found on disk: {$relativePath}");
                    $missing[] = ['id' => $product->id, 'name' => $product->name, 'path' => $relativePath];
                    $skipped++;

                    return;
                }

                $this->line("  <info>REPAIR</info> [{$product->id}] {$product->name}");
                $this->line("         before: {$raw}");
                $this->line("         after:  {$relativePath}");

                if (! $isDryRun) {
                    $product->update(['image_url' => $relativePath]);
                }

                $repaired++;
            });

        $this->newLine();
        $this->table(
            ['Metric', 'Count'],
            [
                ['Records scanned',  $scanned],
                ['Records repaired', $isDryRun ? "{$repaired} (dry-run — not written)" : $repaired],
                ['Records skipped',  $skipped],
                ['Missing files',    count($missing)],
            ],
        );

        if ($missing !== []) {
            $this->newLine();
            $this->warn('Files not found on disk (records left unchanged):');
            foreach ($missing as $m) {
                $this->line("  [{$m['id']}] {$m['name']} → {$m['path']}");
            }
        }

        if ($scanned === 0) {
            $this->info('No legacy absolute image URLs found. Nothing to repair.');
        } elseif (! $isDryRun) {
            $this->info("Repair complete. {$repaired} record(s) updated.");
        }

        return self::SUCCESS;
    }
}
