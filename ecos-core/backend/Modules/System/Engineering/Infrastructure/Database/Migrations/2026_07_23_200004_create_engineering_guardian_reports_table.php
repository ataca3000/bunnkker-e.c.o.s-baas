<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_guardian_reports')) {
            return;
        }

        Schema::create('engineering_guardian_reports', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('run_id');
            $table->uuid('company_id');
            $table->json('summary');
            $table->longText('content');
            $table->timestamp('generated_at');
            $table->timestamp('created_at')->useCurrent();

            $table->index('run_id');
            $table->index('company_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_guardian_reports');
    }
};
