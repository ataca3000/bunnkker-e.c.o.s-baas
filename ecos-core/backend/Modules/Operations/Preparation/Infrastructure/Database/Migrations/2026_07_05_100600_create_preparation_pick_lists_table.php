<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('preparation_pick_lists')) {
            return;
        }

        Schema::create('preparation_pick_lists', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->foreignUuid('preparation_wave_id')
                ->constrained('preparation_waves')
                ->restrictOnDelete()
                ->unique('uq_preparation_pick_lists_wave_id');
            $table->string('status', 50)->default('pending');
            $table->timestampTz('generated_at');
            $table->uuid('generated_by');
            $table->timestampTz('started_at')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->uuid('picker_id')->nullable();
            $table->timestampsTz();
            $table->uuid('created_by');
            $table->uuid('updated_by');
        });

        DB::statement("ALTER TABLE preparation_pick_lists ADD CONSTRAINT chk_pick_lists_status CHECK (status IN ('pending','in_progress','completed'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('preparation_pick_lists');
    }
};
