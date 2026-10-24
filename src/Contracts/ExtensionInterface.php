<?php

declare(strict_types=1);

namespace SubtleForms\Contracts;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Extensions register actions, admin pages, settings, etc.
 */
interface ExtensionInterface {

	public function slug(): string;

	public function register(): void;
}
