<?php

declare(strict_types=1);

namespace App\Core\Actions;

use App\Contracts\ActionInterface;

/**
 * Base class for single-responsibility Action objects.
 *
 * Each Action exposes exactly one public method — {@see BaseAction::execute()} —
 * that performs a single, well-defined unit of work. Dependencies are injected
 * through the constructor; any internal steps must be expressed as `private`
 * or `protected` methods so the public surface stays minimal.
 *
 * Contains no business logic; concrete actions live inside modules.
 */
abstract class BaseAction implements ActionInterface
{
    /**
     * Execute the action's single unit of work.
     *
     * @param  mixed  ...$arguments  Arbitrary input required by the action.
     * @return mixed The result produced by the action.
     */
    abstract public function execute(mixed ...$arguments): mixed;
}
