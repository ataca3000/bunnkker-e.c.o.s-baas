<?php

declare(strict_types=1);

namespace Tests\Feature\IAM;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Modules\IAM\Domain\Contracts\PermissionServiceInterface;
use Modules\IAM\Domain\Models\Permission;
use Modules\IAM\Domain\Models\Role;
use Tests\TestCase;

class DebugCacheTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    public function test_cache_debug(): void
    {
        $role = Role::create(['name' => 'Test', 'slug' => 'test-debug', 'is_system' => false]);
        $perm = Permission::create(['name' => 'a.b.c', 'module' => 'a', 'resource' => 'b', 'action' => 'c']);
        $role->permissions()->attach($perm->id);
        $this->user->roles()->attach($role->id);

        $store = Cache::getStore();
        echo "\nStore: ".get_class($store);

        $service = app(PermissionServiceInterface::class);
        $cacheKey = "rbac.user.{$this->user->id}.perms";

        Cache::forget($cacheKey);
        echo "\nBefore: ".json_encode(Cache::get($cacheKey));

        $result = $service->getUserPermissions($this->user);
        echo "\nService returned: ".json_encode($result);
        echo "\nAfter: ".json_encode(Cache::get($cacheKey));

        $this->assertTrue(true);
    }
}
