<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_validation_reports')) {
            return;
        }

        Schema::create('engineering_validation_reports', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('validation_id');
            $table->uuid('patch_id');
            $table->uuid('company_id');
            $table->string('report_type')->default('full');
            $table->json('summary');
            $table->longText('content');
            $table->timestamp('generated_at');
            $table->timestamp('created_at')->useCurrent();

            $table->index('validation_id');
            $table->index('company_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_validation_reports');
    }
};
