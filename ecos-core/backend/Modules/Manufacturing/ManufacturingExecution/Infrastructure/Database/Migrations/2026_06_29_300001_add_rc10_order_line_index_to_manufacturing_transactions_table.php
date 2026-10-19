<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;

/**
 * RC-10: Idempotency for manufacturing_transactions per order line + BOM version.
 *
 * Originally implemented as a PostgreSQL partial index. Removed for MySQL/MariaDB
 * compatibility — the business rule (each order line manufactured at most once per
 * BOM version) is enforced at the application layer in PrepareOrderManufacturingAction.
 */
return new class extends Migration
{
    public function up(): void
    {
        // No-op: constraint enforced in PrepareOrderManufacturingAction.
    }

    public function down(): void
    {
        // No-op: no index was created.
    }
};
