<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F4. Financial exception register.
 *
 * The output of the financial control checks — an unbalanced journal, a lingering
 * draft, a subledger that does not tie to its control account. Controls are
 * REPORT-ONLY: they write their findings HERE and never modify ledger, budget or
 * VAT data. An exception is opened when detected and can be acknowledged or
 * resolved by a controller; re-running a check will not duplicate an open one.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_control_exceptions', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->foreignId('fiscal_period_id')->nullable()->constrained('finance_fiscal_periods')->nullOnDelete();

            $table->string('check_key', 60);
            $table->string('category', 40)->default('general');
            // info | warning | critical
            $table->string('severity', 12)->default('warning');
            $table->string('entity_type', 80)->nullable();
            $table->string('entity_id', 64)->nullable();
            $table->string('message', 500);

            // open | acknowledged | resolved
            $table->string('status', 20)->default('open');
            $table->timestamp('detected_at');
            $table->unsignedBigInteger('resolved_by')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'check_key', 'entity_type', 'entity_id', 'status'], 'finance_cexc_dedupe_unique');
            $table->index(['company_id', 'status', 'severity'], 'finance_cexc_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_control_exceptions');
    }
};
