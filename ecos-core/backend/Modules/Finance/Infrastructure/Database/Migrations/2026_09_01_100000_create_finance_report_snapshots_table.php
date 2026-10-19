<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F5. Executive report snapshots (read-model archive).
 *
 * ┌─ A DERIVED SNAPSHOT, NOT A FINANCIAL RECORD ────────────────────────────┐
 * │ Executive reports are computed entirely from existing Finance data. When   │
 * │ generated, the derived payload is snapshotted here so a monthly/quarterly/  │
 * │ annual report is reproducible and export-ready. It holds NO transactions    │
 * │ and never affects the ledger — it is a picture of the read models at a      │
 * │ moment in time.                                                            │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_report_snapshots', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->string('report_type', 40); // executive_summary | scorecard | monthly | quarterly | annual | kpi
            $table->string('title', 200);
            $table->date('period_from')->nullable();
            $table->date('period_to')->nullable();
            $table->json('payload');

            $table->unsignedBigInteger('generated_by')->nullable();
            $table->timestamp('generated_at');
            $table->timestamps();

            $table->index(['company_id', 'report_type'], 'finance_rsnap_company_type_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_report_snapshots');
    }
};
