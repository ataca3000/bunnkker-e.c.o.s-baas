<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        if (Schema::hasTable('engineering_release_validation')) { return; }
        Schema::create('engineering_release_validation', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            $table->uuid('release_id')->index();
            $table->string('check_type');
            $table->string('check_name');
            $table->string('status')->default('pending');
            $table->boolean('passed')->default(false);
            $table->text('message')->nullable();
            $table->json('details')->nullable();
            $table->integer('score_contribution')->default(0);
            $table->string('severity')->default('error');
            $table->boolean('is_blocking')->default(true);
            $table->timestamp('checked_at')->nullable();
            $table->timestamps();
            $table->index(['release_id', 'check_type']);
        });
    }
    public function down(): void { Schema::dropIfExists('engineering_release_validation'); }
};
