<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_guardian_checks')) {
            return;
        }

        Schema::create('engineering_guardian_checks', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->uuid('run_id');
            $table->uuid('company_id');
            $table->string('check_name');
            $table->string('category'); // security|adr_compliance|safety|toolchain
            $table->string('status')->default('pending');
            $table->boolean('is_blocking')->default(true);
            $table->longText('details')->nullable();
            $table->json('evidence')->nullable();
            $table->unsignedInteger('duration_ms')->nullable();
            $table->timestamps();

            $table->index('run_id');
            $table->index(['run_id', 'category']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_guardian_checks');
    }
};
