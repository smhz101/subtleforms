<?php
/**
 * SubtleForms Action Registry
 *
 * @package   SubtleForms\Engine
 * @version   0.1.0
 */

namespace SubtleForms\Engine;

use SubtleForms\Contracts\ActionInterface;
use InvalidArgumentException;

/**
 * Registry for action definitions and implementations.
 */
final class ActionRegistry
{
    /**
     * @var array<string, ActionInterface>
     */
    private array $actions = [];

    /**
     * @var array<string, ActionDefinition>
     */
    private array $definitions = [];

    /**
     * Register an action implementation. A definition must exist first.
     */
    public function register(ActionInterface $action): void
    {
        $type = $action->id();
        if (!isset($this->definitions[$type])) {
            throw new InvalidArgumentException(sprintf('Cannot register implementation for unknown action type "%s". Register an ActionDefinition first.', $type));
        }

        $this->actions[$type] = $action;
    }

    /**
     * Register an action definition (metadata + capability requirements).
     */
    public function registerDefinition(ActionDefinition $def): void
    {
        $this->definitions[$def->type()] = $def;
    }

    /**
     * Get an action definition by type or null.
     */
    public function getDefinition(string $type): ?ActionDefinition
    {
        return $this->definitions[$type] ?? null;
    }

    /**
     * Whether a definition exists for type.
     */
    public function hasDefinition(string $type): bool
    {
        return isset($this->definitions[$type]);
    }

    /**
     * Get an action by ID.
     */
    public function get(string $id): ?ActionInterface
    {
        return $this->actions[$id] ?? null;
    }

    /**
     * Get an implementation by type.
     */
    public function getImplementation(string $type): ?ActionInterface
    {
        return $this->actions[$type] ?? null;
    }

    /**
     * Check if an action exists.
     */
    public function has(string $id): bool
    {
        return isset($this->actions[$id]);
    }

    /**
     * Get all registered action implementations.
     *
     * @return array<string, ActionInterface>
     */
    public function all(): array
    {
        return $this->actions;
    }

    /**
     * Remove an action implementation.
     */
    public function remove(string $id): void
    {
        unset($this->actions[$id]);
    }
}
