<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Terminal;

use Modules\POS\Terminal\Domain\Enums\TerminalStatus;
use PHPUnit\Framework\TestCase;

/**
 * PKG-POS-003: TerminalStatus enum unit tests.
 */
final class TerminalStatusTest extends TestCase
{
    public function test_can_accept_sessions_only_when_active(): void
    {
        $this->assertTrue(TerminalStatus::Active->canAcceptSessions());
        $this->assertFalse(TerminalStatus::Inactive->canAcceptSessions());
        $this->assertFalse(TerminalStatus::Maintenance->canAcceptSessions());
    }

    public function test_is_operational_for_active_and_maintenance(): void
    {
        $this->assertTrue(TerminalStatus::Active->isOperational());
        $this->assertTrue(TerminalStatus::Maintenance->isOperational());
        $this->assertFalse(TerminalStatus::Inactive->isOperational());
    }

    public function test_labels_are_non_empty_strings(): void
    {
        foreach (TerminalStatus::cases() as $case) {
            $this->assertNotEmpty($case->label());
        }
    }

    public function test_backed_values_are_lowercase(): void
    {
        $this->assertSame('active', TerminalStatus::Active->value);
        $this->assertSame('inactive', TerminalStatus::Inactive->value);
        $this->assertSame('maintenance', TerminalStatus::Maintenance->value);
    }

    public function test_from_string_resolves_correctly(): void
    {
        $this->assertSame(TerminalStatus::Active, TerminalStatus::from('active'));
        $this->assertSame(TerminalStatus::Inactive, TerminalStatus::from('inactive'));
        $this->assertSame(TerminalStatus::Maintenance, TerminalStatus::from('maintenance'));
    }

    public function test_try_from_returns_null_for_unknown(): void
    {
        $this->assertNull(TerminalStatus::tryFrom('unknown'));
    }
}
