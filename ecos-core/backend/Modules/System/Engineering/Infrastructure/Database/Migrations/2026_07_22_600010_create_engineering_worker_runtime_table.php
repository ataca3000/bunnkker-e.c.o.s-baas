<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_worker_runtime')) {
            return;
        }

        Schema::create('engineering_worker_runtime', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->uuid('worker_id')->index();
            $table->uuid('session_id')->nullable()->index();
            $table->string('metric_key', 100);
            $table->decimal('metric_value', 12, 4);
            $table->string('metric_unit', 20)->nullable();
            $table->timestamp('recorded_at');

            $table->index(['worker_id', 'recorded_at']);
            $table->index(['worker_id', 'metric_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_worker_runtime');
    }
};
