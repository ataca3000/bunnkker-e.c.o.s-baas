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
        if (Schema::hasTable('preparation_wave_workers')) {
            return;
        }

        Schema::create('preparation_wave_workers', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->foreignUuid('preparation_wave_id')
                ->constrained('preparation_waves')
                ->restrictOnDelete();
            $table->unsignedBigInteger('user_id');
            $table->foreign('user_id')->references('id')->on('users')->restrictOnDelete();
            $table->string('role', 50);
            $table->timestampTz('assigned_at')->useCurrent();
            $table->uuid('assigned_by');
            $table->timestampTz('released_at')->nullable();
            $table->uuid('released_by')->nullable();

            $table->index('preparation_wave_id', 'idx_wave_workers_wave_id');
            $table->index('user_id', 'idx_wave_workers_user_id');
        });

        DB::statement("ALTER TABLE preparation_wave_workers ADD CONSTRAINT chk_wave_workers_role CHECK (role IN ('supervisor','operator','quality_checker'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('preparation_wave_workers');
    }
};
