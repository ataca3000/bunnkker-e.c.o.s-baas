<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('marketing_reports')) {
            return;
        }

        Schema::create('marketing_reports', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('company_id')->nullable()->index();
            $table->string('connection_id')->nullable();
            $table->string('type', 10);           // csv | excel | pdf | html
            $table->string('status', 20)->default('pending'); // pending | completed | failed
            $table->string('report_name');
            $table->json('filters');              // IntelligenceFilterDto serialized
            $table->string('file_path')->nullable();
            $table->text('error_message')->nullable();
            $table->unsignedInteger('row_count')->nullable();
            $table->string('generated_by')->nullable(); // user_id
            $table->timestamp('generated_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_reports');
    }
};
