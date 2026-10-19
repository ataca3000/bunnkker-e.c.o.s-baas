<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        if (Schema::hasTable('engineering_release_approvals')) { return; }
        Schema::create('engineering_release_approvals', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            $table->uuid('release_id')->index();
            $table->string('approval_level');
            $table->string('approval_role');
            $table->uuid('approver_id')->nullable()->index();
            $table->string('status')->default('pending');
            $table->text('comment')->nullable();
            $table->string('decision')->nullable();
            $table->integer('sequence')->default(1);
            $table->boolean('is_required')->default(true);
            $table->timestamp('requested_at')->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
            $table->index(['release_id', 'approval_level']);
        });
    }
    public function down(): void { Schema::dropIfExists('engineering_release_approvals'); }
};
