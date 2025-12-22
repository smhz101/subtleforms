<?php
declare(strict_types=1);

namespace SubtleForms\Engine;

use SubtleForms\Engine\ActionRegistry as AR;
use SubtleForms\Contracts\ActionInterface;
use InvalidArgumentException;

/**
 * Compile a validated form schema into PipelineStep instances.
 */
final class SchemaCompiler
{
    private AR $registry;
    private ConditionalLogic $conditionalLogic;

    public function __construct(AR $registry, ?ConditionalLogic $conditionalLogic = null)
    {
        $this->registry = $registry;
        $this->conditionalLogic = $conditionalLogic ?? new ConditionalLogic();
    }

    /**
     * @param array<string,mixed> $schema The validated schema array
     * @return PipelineStepInterface[]
     */
    public function compile(array $schema): array
    {
        $steps = [];

        $actions = $schema['actions'] ?? [];
        if (!is_array($actions)) {
            throw new InvalidArgumentException('Schema.actions must be an array');
        }

        // CRITICAL: Ensure SaveAction always exists as first action
        // If no 'save' action exists in schema, inject one automatically
        $hasSaveAction = false;
        foreach ($actions as $act) {
            if (is_array($act) && isset($act['type']) && $act['type'] === 'save') {
                $hasSaveAction = true;
                break;
            }
        }

        if (!$hasSaveAction) {
            // Inject SaveAction as first action
            array_unshift($actions, ['type' => 'save', 'settings' => []]);
        } else {
            // Ensure SaveAction runs first if present: move first 'save' action to index 0.
            foreach ($actions as $idx => $a) {
                if (is_array($a) && isset($a['type']) && $a['type'] === 'save') {
                    if ($idx !== 0) {
                        array_splice($actions, $idx, 1);
                        array_unshift($actions, $a);
                    }
                    break;
                }
            }
        }

        foreach ($actions as $i => $act) {
            if (!is_array($act) || empty($act['type']) || !is_string($act['type'])) {
                throw new InvalidArgumentException("Action at index {$i} must be an object with string 'type'.");
            }

            $type = $act['type'];

            // Resolve definition first
            $def = $this->registry->getDefinition($type);
            if ($def === null) {
                throw new InvalidArgumentException(sprintf("Action type '%s' is not defined. Register an ActionDefinition before using it in schemas.", $type));
            }

            // Resolve implementation
            $actionImpl = $this->registry->getImplementation($type);
            if ($actionImpl === null) {
                throw new InvalidArgumentException(sprintf("No implementation registered for action type '%s'.", $type));
            }

            // Deterministic step id: action:type:index
            $stepId = sprintf('action:%s:%d', $type, $i);

            // Capabilities required: combine definition-level and instance-level requires
            $defCaps = $def->requiredCapabilities();
            $instanceCaps = [];
            if (isset($act['requires']) && is_array($act['requires'])) {
                $instanceCaps = array_values(array_filter($act['requires'], fn($v) => is_string($v)));
            }
            $requires = array_values(array_unique(array_merge($defCaps, $instanceCaps)));

            $skippable = isset($act['skippable']) ? (bool) $act['skippable'] : false;

            $settings = isset($act['settings']) && is_array($act['settings']) ? $act['settings'] : [];

            // Note: actionImpl acts as a prototype; pass instance settings to the step.
            $steps[] = new PipelineStep($stepId, $actionImpl, $requires, $skippable, $settings);
        }

        return $steps;
    }

    /**
     * Evaluate conditional logic and attach metadata to submission context.
     * 
     * @param array<string,mixed> $schema
     * @param SubmissionContext $ctx
     */
    public function evaluateConditions(array $schema, SubmissionContext $ctx): void
    {
        $conditionalState = $this->conditionalLogic->evaluate($schema, $ctx->payload);
        
        $ctx->setMeta('conditional_state', $conditionalState);
        $ctx->setMeta('hidden_fields', $conditionalState['hidden_fields']);
        $ctx->setMeta('required_fields', $conditionalState['required_fields']);
        $ctx->setMeta('disabled_fields', $conditionalState['disabled_fields']);
        $ctx->setMeta('hidden_steps', $conditionalState['hidden_steps']);
    }
}
