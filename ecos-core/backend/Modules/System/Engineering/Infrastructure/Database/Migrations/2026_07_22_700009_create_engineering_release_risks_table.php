<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        if (Schema::hasTable('engineering_release_risks')) { return; }
        Schema::create('engineering_release_risks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            $table->uuid('release_id')->index();
            $table->string('risk_category');
            $table->string('risk_title');
            $table->text('risk_description');
            $table->string('severity')->default('medium');
            $table->string('likelihood')->default('medium');
            $table->integer('risk_score')->default(0);
            $table->text('mitigation_plan')->nullable();
            $table->boolean('is_accepted')->default(false);
            $table->uuid('accepted_by')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->softDeletes();
            $table->timestamps();
            $table->index(['release_id', 'severity']);
        });
    }
    public function down(): void { Schema::dropIfExists('engineering_release_risks'); }
};
