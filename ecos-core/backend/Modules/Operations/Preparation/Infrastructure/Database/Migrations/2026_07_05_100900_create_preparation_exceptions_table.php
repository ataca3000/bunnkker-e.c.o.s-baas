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
        if (Schema::hasTable('preparation_exceptions')) {
            return;
        }

        Schema::create('preparation_exceptions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->foreignUuid('preparation_wave_id')
                ->constrained('preparation_waves')
                ->restrictOnDelete();
            $table->string('exception_type', 100);
            $table->string('severity', 20);
            $table->string('entity_type', 50)->nullable();
            $table->uuid('entity_id')->nullable();
            $table->text('description');
            $table->string('status', 50)->default('open');
            $table->timestampTz('resolved_at')->nullable();
            $table->uuid('resolved_by')->nullable();
            $table->text('resolution_notes')->nullable();
            $table->timestampTz('escalated_at')->nullable();
            $table->uuid('escalated_to')->nullable();
            $table->timestampsTz();
            $table->uuid('created_by');
            $table->uuid('updated_by');

            $table->index('preparation_wave_id', 'idx_prep_exceptions_wave_id');
        });

        DB::statement("ALTER TABLE preparation_exceptions ADD CONSTRAINT chk_prep_exceptions_severity CHECK (severity IN ('blocking','warning','informational'))");
        DB::statement("ALTER TABLE preparation_exceptions ADD CONSTRAINT chk_prep_exceptions_status CHECK (status IN ('open','resolved','escalated','closed'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('preparation_exceptions');
    }
};
