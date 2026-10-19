<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('
            ALTER TABLE preparation_wave_orders
            ADD COLUMN delivery_window_id       CHAR(36)        NULL AFTER delivery_zone_snapshot,
            ADD COLUMN delivery_window_label    VARCHAR(100)    NULL AFTER delivery_window_id,
            ADD COLUMN delivery_window_starts_at TIME           NULL AFTER delivery_window_label,
            ADD COLUMN delivery_window_ends_at   TIME           NULL AFTER delivery_window_starts_at,
            ADD COLUMN governorate_snapshot     VARCHAR(100)    NULL AFTER delivery_window_ends_at,
            ADD COLUMN master_governorate_id    CHAR(36)        NULL AFTER governorate_snapshot,
            ADD COLUMN zone_code_snapshot       VARCHAR(20)     NULL AFTER master_governorate_id,
            ADD COLUMN master_zone_id           CHAR(36)        NULL AFTER zone_code_snapshot,
            ADD COLUMN shipping_cost_snapshot   DECIMAL(10,2)   NULL AFTER master_zone_id,
            ADD COLUMN preparation_priority     TINYINT UNSIGNED NOT NULL DEFAULT 5 AFTER shipping_cost_snapshot,
            ADD COLUMN is_paid                  TINYINT(1)      NOT NULL DEFAULT 0 AFTER preparation_priority
        ');

        DB::statement('ALTER TABLE preparation_wave_orders ADD INDEX idx_pwo_zone_code (zone_code_snapshot)');
        DB::statement('ALTER TABLE preparation_wave_orders ADD INDEX idx_pwo_prep_priority (preparation_priority)');
        DB::statement('ALTER TABLE preparation_wave_orders ADD INDEX idx_pwo_window_id (delivery_window_id)');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE preparation_wave_orders DROP INDEX idx_pwo_zone_code');
        DB::statement('ALTER TABLE preparation_wave_orders DROP INDEX idx_pwo_prep_priority');
        DB::statement('ALTER TABLE preparation_wave_orders DROP INDEX idx_pwo_window_id');
        DB::statement('
            ALTER TABLE preparation_wave_orders
            DROP COLUMN delivery_window_id,
            DROP COLUMN delivery_window_label,
            DROP COLUMN delivery_window_starts_at,
            DROP COLUMN delivery_window_ends_at,
            DROP COLUMN governorate_snapshot,
            DROP COLUMN master_governorate_id,
            DROP COLUMN zone_code_snapshot,
            DROP COLUMN master_zone_id,
            DROP COLUMN shipping_cost_snapshot,
            DROP COLUMN preparation_priority,
            DROP COLUMN is_paid
        ');
    }
};
