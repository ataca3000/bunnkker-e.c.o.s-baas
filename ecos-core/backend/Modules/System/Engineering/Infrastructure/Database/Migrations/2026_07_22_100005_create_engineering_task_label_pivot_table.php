<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('engineering_task_label_pivot')) {
            return;
        }

        Schema::create('engineering_task_label_pivot', function (Blueprint $table) {
            $table->uuid('task_id');
            $table->uuid('label_id');
            $table->timestamps();

            $table->primary(['task_id', 'label_id']);

            $table->foreign('task_id')
                ->references('id')
                ->on('engineering_tasks')
                ->cascadeOnDelete();

            $table->foreign('label_id')
                ->references('id')
                ->on('engineering_task_labels')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_task_label_pivot');
    }
};
