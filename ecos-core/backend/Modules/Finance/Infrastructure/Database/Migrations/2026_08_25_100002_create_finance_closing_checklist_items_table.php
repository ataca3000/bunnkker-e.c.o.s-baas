<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F4. Closing checklist items.
 *
 * The concrete checks a closing run must clear — trial balance ties, no draft
 * journals, subledgers reconcile, VAT settled, budgets within tolerance. A
 * blocking item that has not passed prevents the close. The checklist is
 * regenerated (re-evaluated) each time the run is validated.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_closing_checklist_items', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->foreignId('closing_run_id')->constrained('finance_closing_runs')->cascadeOnDelete();

            $table->string('key', 60);
            $table->string('label', 200);
            $table->string('category', 40)->default('general');
            // pending | passed | failed | skipped
            $table->string('status', 20)->default('pending');
            $table->boolean('is_blocking')->default(true);
            $table->text('detail')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index('closing_run_id', 'finance_ccheck_run_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_closing_checklist_items');
    }
};
