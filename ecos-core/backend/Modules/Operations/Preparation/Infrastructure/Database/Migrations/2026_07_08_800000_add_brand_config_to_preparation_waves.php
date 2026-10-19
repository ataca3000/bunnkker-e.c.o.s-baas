<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('
            ALTER TABLE preparation_waves
            ADD COLUMN brand_id          CHAR(36)       NULL AFTER warehouse_id,
            ADD COLUMN channel_id        CHAR(36)       NULL AFTER brand_id,
            ADD COLUMN delivery_window_id     CHAR(36)  NULL AFTER channel_id,
            ADD COLUMN delivery_window_label  VARCHAR(100) NULL AFTER delivery_window_id,
            ADD COLUMN policy_snapshot   JSON           NULL AFTER config_version_id,
            ADD COLUMN wave_type         VARCHAR(20)    NOT NULL DEFAULT \'standard\' AFTER policy_snapshot,
            ADD COLUMN priority_score    TINYINT UNSIGNED NULL AFTER wave_type
        ');

        DB::statement('ALTER TABLE preparation_waves ADD INDEX idx_prep_waves_brand_id (brand_id)');
        DB::statement('ALTER TABLE preparation_waves ADD INDEX idx_prep_waves_channel_id (channel_id)');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE preparation_waves DROP INDEX idx_prep_waves_brand_id');
        DB::statement('ALTER TABLE preparation_waves DROP INDEX idx_prep_waves_channel_id');
        DB::statement('
            ALTER TABLE preparation_waves
            DROP COLUMN brand_id,
            DROP COLUMN channel_id,
            DROP COLUMN delivery_window_id,
            DROP COLUMN delivery_window_label,
            DROP COLUMN policy_snapshot,
            DROP COLUMN wave_type,
            DROP COLUMN priority_score
        ');
    }
};
