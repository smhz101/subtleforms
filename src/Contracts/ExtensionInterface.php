<?php
declare(strict_types=1);

namespace SubtleForms\Contracts;

/**
 * Extensions register actions, admin pages, settings, etc.
 */
interface ExtensionInterface {

	public function slug(): string;

	public function register(): void;

	/**
	 * @return string[] Required capabilities to enable this extension.
	 */
	public function requiredCapabilities(): array;
}
