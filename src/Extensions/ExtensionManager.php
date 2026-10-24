<?php

declare(strict_types=1);

namespace SubtleForms\Extensions;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Contracts\ExtensionInterface;

/**
 * Central extension loader.
 */
final class ExtensionManager {

	/**
	 * @var ExtensionInterface[]
	 */
	private $extensions = array();

	/**
	 * @param mixed $gate Not used since 2.7.2; kept so existing callers work.
	 */
	public function __construct( $gate = null ) {
		unset( $gate );
	}

	public function add( ExtensionInterface $ext ): void {
		$this->extensions[] = $ext;
	}

	public function boot(): void {
		// Every extension an add-on added is registered. Whether its
		// features are available is the add-on's own business.
		foreach ( $this->extensions as $ext ) {
			$ext->register();
		}
	}
}
