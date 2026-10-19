<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        if (Schema::hasTable('engineering_release_packages')) { return; }
        Schema::create('engineering_release_packages', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            $table->uuid('release_id')->index();
            $table->string('package_type')->default('standard');
            $table->string('file_path')->nullable();
            $table->bigInteger('file_size_bytes')->default(0);
            $table->string('checksum')->nullable();
            $table->json('manifest')->nullable();
            $table->json('metadata_payload')->nullable();
            $table->string('status')->default('building');
            $table->timestamp('built_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('engineering_release_packages'); }
};
