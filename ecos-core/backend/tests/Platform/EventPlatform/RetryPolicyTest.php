<?php

declare(strict_types=1);

namespace Tests\Platform\EventPlatform;

use Modules\Platform\EventPlatform\Domain\ValueObjects\RetryPolicy;
use Tests\TestCase;

class RetryPolicyTest extends TestCase
{
    public function test_none_policy_has_no_retries(): void
    {
        $policy = RetryPolicy::none();
        $this->assertEquals(1, $policy->getMaxAttempts());
        $this->assertFalse($policy->shouldRetry(1));
    }

    public function test_standard_policy(): void
    {
        $policy = RetryPolicy::standard();
        $this->assertEquals(5, $policy->getMaxAttempts()); // 1 initial + 4 retries
        $this->assertEquals([5, 30, 300, 3600], $policy->getDelays());
        $this->assertTrue($policy->shouldRetry(1));
        $this->assertTrue($policy->shouldRetry(4));
        $this->assertFalse($policy->shouldRetry(5));
    }

    public function test_aggressive_policy(): void
    {
        $policy = RetryPolicy::aggressive();
        $this->assertEquals(6, $policy->getMaxAttempts()); // 1 + 5 retries
        $this->assertFalse($policy->shouldRetry(6));
    }

    public function test_custom_policy(): void
    {
        $policy = RetryPolicy::custom([10, 60, 600]);
        $this->assertEquals(4, $policy->getMaxAttempts());
        $this->assertEquals(10, $policy->getDelayForAttempt(2));
        $this->assertEquals(60, $policy->getDelayForAttempt(3));
        $this->assertEquals(600, $policy->getDelayForAttempt(4));
    }

    public function test_immediate_policy(): void
    {
        $policy = RetryPolicy::immediate();
        $this->assertEquals(2, $policy->getMaxAttempts()); // 1 + 1 immediate retry
        $this->assertEquals(0, $policy->getDelayForAttempt(2));
    }

    public function test_roundtrip_serialization(): void
    {
        $policy = RetryPolicy::standard();
        $data = $policy->toArray();
        $restored = RetryPolicy::fromArray($data);

        $this->assertEquals($policy->getDelays(), $restored->getDelays());
        $this->assertEquals($policy->getMaxAttempts(), $restored->getMaxAttempts());
    }
}
