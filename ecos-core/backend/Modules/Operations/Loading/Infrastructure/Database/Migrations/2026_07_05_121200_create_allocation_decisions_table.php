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
        if (Schema::hasTable('allocation_decisions')) {
            return;
        }

        Schema::create('allocation_decisions', function (Blueprint $table): void {
            $table->char('id', 26)->primary();
            $table->uuid('company_id');
            $table->foreignUuid('allocation_record_id')->constrained('allocation_records')->restrictOnDelete();
            $table->integer('revision_number');
            $table->string('actor_type', 20);
            $table->uuid('actor_id')->nullable();
            $table->decimal('quantity_before', 18, 4);
            $table->decimal('quantity_after', 18, 4);
            $table->text('reason');
            $table->uuid('policy_evaluation_id')->nullable();
            $table->timestampTz('recorded_at')->useCurrent();
        });

        DB::statement("ALTER TABLE allocation_decisions ADD CONSTRAINT chk_allocation_decisions_actor_type CHECK (actor_type IN ('system','dispatcher','driver'))");
        DB::statement('ALTER TABLE allocation_decisions ADD CONSTRAINT chk_allocation_decisions_revision_number CHECK (revision_number >= 1)');
        DB::statement('ALTER TABLE allocation_decisions ADD CONSTRAINT chk_allocation_decisions_quantity_before CHECK (quantity_before >= 0)');
        DB::statement('ALTER TABLE allocation_decisions ADD CONSTRAINT chk_allocation_decisions_quantity_after CHECK (quantity_after >= 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('allocation_decisions');
    }
};
