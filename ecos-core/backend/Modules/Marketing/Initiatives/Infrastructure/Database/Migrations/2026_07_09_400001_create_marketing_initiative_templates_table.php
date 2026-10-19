<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Initiative Templates — reusable presets for common business objectives.
 *
 * System templates (is_system=true) are shipped with ECOS.
 * Users can create custom templates.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('marketing_initiative_templates')) {
            return;
        }

        Schema::create('marketing_initiative_templates', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name', 255);
            $table->string('slug', 100)->unique();
            $table->text('description')->nullable();
            $table->string('category', 100)->nullable()->index('mkt_tpl_category_idx');
            $table->json('defaults')->nullable();
            $table->boolean('is_system')->default(false)->index('mkt_tpl_system_idx');
            $table->unsignedInteger('usage_count')->default(0);
            $table->string('created_by', 36)->nullable();
            $table->timestamps();
        });

        // Seed system templates
        $now = now();
        DB::table('marketing_initiative_templates')->insert([
            [
                'id' => Str::uuid()->toString(),
                'name' => 'Product Launch',
                'slug' => 'product-launch',
                'description' => 'Launch a new product with brand awareness and acquisition campaigns.',
                'category' => 'launch',
                'defaults' => json_encode(['business_goal' => 'product_launch', 'status' => 'draft']),
                'is_system' => true,
                'usage_count' => 0,
                'created_by' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => Str::uuid()->toString(),
                'name' => 'Brand Awareness',
                'slug' => 'brand-awareness',
                'description' => 'Increase brand recognition across target demographics.',
                'category' => 'awareness',
                'defaults' => json_encode(['business_goal' => 'brand_awareness', 'status' => 'draft']),
                'is_system' => true,
                'usage_count' => 0,
                'created_by' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => Str::uuid()->toString(),
                'name' => 'Customer Acquisition',
                'slug' => 'customer-acquisition',
                'description' => 'Drive new customer acquisition through targeted campaigns.',
                'category' => 'growth',
                'defaults' => json_encode(['business_goal' => 'customer_acquisition', 'status' => 'draft']),
                'is_system' => true,
                'usage_count' => 0,
                'created_by' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => Str::uuid()->toString(),
                'name' => 'Customer Retention',
                'slug' => 'customer-retention',
                'description' => 'Re-engage existing customers and reduce churn.',
                'category' => 'retention',
                'defaults' => json_encode(['business_goal' => 'customer_retention', 'status' => 'draft']),
                'is_system' => true,
                'usage_count' => 0,
                'created_by' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => Str::uuid()->toString(),
                'name' => 'Ramadan Campaign',
                'slug' => 'ramadan-campaign',
                'description' => 'Seasonal initiative for Ramadan — maximize sales during the holy month.',
                'category' => 'seasonal',
                'defaults' => json_encode(['season' => 'ramadan', 'business_goal' => 'sales_growth', 'status' => 'draft']),
                'is_system' => true,
                'usage_count' => 0,
                'created_by' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => Str::uuid()->toString(),
                'name' => 'Black Friday',
                'slug' => 'black-friday',
                'description' => 'Drive maximum sales during the Black Friday season.',
                'category' => 'seasonal',
                'defaults' => json_encode(['season' => 'black_friday', 'business_goal' => 'sales_growth', 'status' => 'draft']),
                'is_system' => true,
                'usage_count' => 0,
                'created_by' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => Str::uuid()->toString(),
                'name' => 'Summer Promotion',
                'slug' => 'summer-promotion',
                'description' => 'Seasonal summer promotion initiative.',
                'category' => 'seasonal',
                'defaults' => json_encode(['season' => 'summer', 'business_goal' => 'sales_growth', 'status' => 'draft']),
                'is_system' => true,
                'usage_count' => 0,
                'created_by' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => Str::uuid()->toString(),
                'name' => 'New Branch Opening',
                'slug' => 'new-branch-opening',
                'description' => 'Promote awareness for a new branch or location.',
                'category' => 'launch',
                'defaults' => json_encode(['business_goal' => 'brand_awareness', 'status' => 'draft']),
                'is_system' => true,
                'usage_count' => 0,
                'created_by' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_initiative_templates');
    }
};
