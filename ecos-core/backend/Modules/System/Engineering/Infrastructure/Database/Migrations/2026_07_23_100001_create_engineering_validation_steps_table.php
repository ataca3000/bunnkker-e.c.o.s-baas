<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_validation_steps')) {
            return;
        }

        Schema::create('engineering_validation_steps', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->uuid('validation_id');
            $table->uuid('company_id');
            $table->string('validator');
            $table->unsignedInteger('sequence');
            $table->string('status')->default('pending');
            $table->boolean('is_blocking')->default(true);
            $table->boolean('is_applicable')->default(true);
            $table->integer('exit_code')->nullable();
            $table->longText('output')->nullable();
            $table->longText('error_output')->nullable();
            $table->unsignedInteger('duration_ms')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index('validation_id');
            $table->index(['validation_id', 'validator']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_validation_steps');
    }
};
