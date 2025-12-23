<?php
declare(strict_types=1);

namespace SubtleForms\Extensions;

use SubtleForms\Contracts\ExtensionInterface;
use SubtleForms\Support\FeatureGate;

/**
 * Central extension loader with capability enforcement.
 */
final class ExtensionManager
{
    /**
     * @var ExtensionInterface[]
     */
    private $extensions = [];
    
    /**
     * @var FeatureGate
     */
    private $gate;

    /**
     * @param FeatureGate $gate
     */
    public function __construct($gate) {
        $this->gate = $gate;
    }

    public function add(ExtensionInterface $ext): void
    {
        $this->extensions[] = $ext;
    }

    public function boot(): void
    {
        foreach ($this->extensions as $ext) {
            foreach ($ext->requiredCapabilities() as $cap) {
                if (!$this->gate->allows($cap)) {
                    continue 2; // extension disabled
                }
            }

            $ext->register();
        }
    }
}
