<?php
/**
 * WordPress Test Framework Stubs
 * This file provides type hints for WordPress test classes to prevent IDE errors
 * 
 * @package SubtleForms
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

/**
 * WordPress Unit Test Case Base Class
 */
class WP_UnitTestCase extends PHPUnit\Framework\TestCase {
    /** @var WP_UnitTest_Factory */
    protected $factory;
    
    public function setUp(): void {}
    public function tearDown(): void {}
}

/**
 * WordPress Test Factory
 */
class WP_UnitTest_Factory {
    /** @var WP_UnitTest_Factory_For_User */
    public $user;
    
    /** @var WP_UnitTest_Factory_For_Post */
    public $post;
    
    /** @var WP_UnitTest_Factory_For_Term */
    public $term;
}

/**
 * User Factory
 */
class WP_UnitTest_Factory_For_User {
    /**
     * Create a user
     * @param array $args
     * @return int
     */
    public function create($args = []) {
        return 0;
    }
}

/**
 * Post Factory
 */
class WP_UnitTest_Factory_For_Post {
    /**
     * Create a post
     * @param array $args
     * @return int
     */
    public function create($args = []) {
        return 0;
    }
}

/**
 * Term Factory
 */
class WP_UnitTest_Factory_For_Term {
    /**
     * Create a term
     * @param array $args
     * @return int
     */
    public function create($args = []) {
        return 0;
    }
}
