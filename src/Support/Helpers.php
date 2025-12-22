<?php

/**
 * Subtle Forms
 *
 * @package   SubtleForms\Support
 * @version   0.1.0
 */

namespace SubtleForms\Support;

/**
 * Global helper accessors.
 * You can later replace these with your Container calls.
 */
final class Helpers {
  public static function caps(): Capabilities {
    static $caps = null;

    if (!$caps) {
      $caps = new Capabilities();
    }

    return $caps;
  }
  
  public static function gate(): FeatureGate {
    static $gate = null;

    if (!$gate) {
      $gate = new FeatureGate(self::caps());
    }

    return $gate;
  }
}
