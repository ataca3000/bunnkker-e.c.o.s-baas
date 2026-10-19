<?php

declare(strict_types=1);

namespace Tests\Feature\Operations\WaveEngine;

use Modules\Operations\Preparation\Domain\Enums\WaveStatus;
use Tests\TestCase;

class WaveStatusEnumTest extends TestCase
{
    // ── isActive ──────────────────────────────────────────────────────────────

    public function test_collecting_is_active(): void
    {
        $this->assertTrue(WaveStatus::Collecting->isActive());
    }

    public function test_preparing_is_active(): void
    {
        $this->assertTrue(WaveStatus::Preparing->isActive());
    }

    public function test_closed_is_not_active(): void
    {
        $this->assertFalse(WaveStatus::Closed->isActive());
    }

    public function test_completed_is_not_active(): void
    {
        $this->assertFalse(WaveStatus::Completed->isActive());
    }

    // ── isTerminal ────────────────────────────────────────────────────────────

    public function test_closed_is_terminal(): void
    {
        $this->assertTrue(WaveStatus::Closed->isTerminal());
    }

    public function test_completed_is_terminal(): void
    {
        $this->assertTrue(WaveStatus::Completed->isTerminal());
    }

    public function test_cancelled_is_terminal(): void
    {
        $this->assertTrue(WaveStatus::Cancelled->isTerminal());
    }

    public function test_collecting_is_not_terminal(): void
    {
        $this->assertFalse(WaveStatus::Collecting->isTerminal());
    }

    // ── canTransitionTo ───────────────────────────────────────────────────────

    public function test_draft_can_transition_to_collecting(): void
    {
        $this->assertTrue(WaveStatus::Draft->canTransitionTo(WaveStatus::Collecting));
    }

    public function test_draft_can_transition_to_planning(): void
    {
        $this->assertTrue(WaveStatus::Draft->canTransitionTo(WaveStatus::Planning));
    }

    public function test_collecting_can_transition_to_preparing(): void
    {
        $this->assertTrue(WaveStatus::Collecting->canTransitionTo(WaveStatus::Preparing));
    }

    public function test_collecting_can_be_cancelled(): void
    {
        $this->assertTrue(WaveStatus::Collecting->canTransitionTo(WaveStatus::Cancelled));
    }

    public function test_collecting_cannot_transition_to_closed_directly(): void
    {
        // Collecting → Closed is not a valid transition; must go Collecting → Preparing → Closed
        $this->assertFalse(WaveStatus::Collecting->canTransitionTo(WaveStatus::Closed));
    }

    public function test_preparing_can_transition_to_closed(): void
    {
        $this->assertTrue(WaveStatus::Preparing->canTransitionTo(WaveStatus::Closed));
    }

    public function test_preparing_can_transition_to_completed(): void
    {
        $this->assertTrue(WaveStatus::Preparing->canTransitionTo(WaveStatus::Completed));
    }

    public function test_closed_cannot_transition_to_anything(): void
    {
        foreach (WaveStatus::cases() as $next) {
            $this->assertFalse(WaveStatus::Closed->canTransitionTo($next));
        }
    }
}
